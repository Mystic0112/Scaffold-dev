#!/usr/bin/env node
'use strict';

// CLI usada pelos skills do plugin (e por você, se quiser):
//   node cli.js contexto [prever|revisar|explicar|estudo|progresso|config]
//   node cli.js perfil
//   node cli.js config <nivel|stack|lembretes|idioma> <valor>
//   node cli.js mudancas [--limite 20] [--todas]
//   node cli.js registrar --tipo <previsao|revisao|explicacao> --nota <0-10> [--areas a,b] [--conceitos "x,y"] [--resumo "..."]
//   node cli.js trilha
//   node cli.js diario [--limite 20]
//   node cli.js export-dir
//   node cli.js painel [--saida <arquivo>] [--abrir] [--servir] [--porta 4173]

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const store = require('./lib/store');
const { calcularMetricas } = require('./lib/metricas');
const { gerarHtml } = require('./lib/painel-html');

const TIPOS = ['previsao', 'revisao', 'explicacao'];
const NIVEIS = ['estagiario', 'junior', 'pleno'];

function args(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const prox = argv[i + 1];
      if (prox === undefined || prox.startsWith('--')) flags[a.slice(2)] = true;
      else flags[a.slice(2)] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

function lista(v) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizar(p) {
  if (process.platform !== 'win32') return path.resolve(p || '');
  // Git Bash/MSYS entrega "/c/Users/..." — converte para "C:/Users/..."
  const msys = String(p || '').replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:');
  return path.resolve(msys).toLowerCase();
}

function statusGit(limite) {
  try {
    const saida = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    const linhas = saida.split('\n').filter(Boolean);
    if (!linhas.length) return '';
    const resto = linhas.length > limite ? `\n- … e mais ${linhas.length - limite}` : '';
    return linhas.slice(0, limite).map((l) => `- \`${l.slice(0, 2)}\` ${l.slice(3)}`).join('\n') + resto;
  } catch {
    return ''; // sem git ou fora de um repositório
  }
}

function carregarTrilha(idioma) {
  const base = path.join(__dirname, '..', 'data');
  const alvo = path.join(base, idioma, 'trilha.json');
  return JSON.parse(fs.readFileSync(fs.existsSync(alvo) ? alvo : path.join(base, 'pt-BR', 'trilha.json'), 'utf8'));
}

function media(s) {
  return s && s.total ? s.somaNotas / s.total : null;
}

function barra(nota) {
  if (nota === null) return '░░░░░░░░░░  —';
  const cheio = Math.round(nota);
  return '█'.repeat(cheio) + '░'.repeat(10 - cheio) + `  ${nota.toFixed(1)}`;
}

const comandos = {
  perfil() {
    const p = store.lerPerfil();
    const e = p.estatisticas;
    const linha = (nome, s) =>
      `- ${nome}: ${s.total} feita(s)` + (s.total ? `, média ${media(s).toFixed(1)}/10` : '');
    const topConceitos = Object.entries(p.conceitos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c, n]) => `${c} (${n})`)
      .join(', ');
    return [
      `## Perfil Scaffold Dev`,
      `- Nível: ${p.nivel}${p.stack ? ` · Stack: ${p.stack}` : ''} · Idioma: ${p.idioma}`,
      `- Lembretes: ${p.lembretes ? 'ligados' : 'desligados'}`,
      '',
      '### Prática',
      linha('Previsões', e.previsao),
      linha('Revisões de código', e.revisao),
      linha('Explicações (Feynman)', e.explicacao),
      '',
      `### Conceitos mais estudados`,
      topConceitos || '- nenhum ainda',
      '',
      `Dados em: ${store.dataDir()}`,
    ].join('\n');
  },

  config({ pos }) {
    const [chave, valor] = pos;
    const p = store.lerPerfil();
    if (chave === 'nivel') {
      if (!NIVEIS.includes(valor)) throw new Error(`nível deve ser: ${NIVEIS.join(' | ')}`);
      p.nivel = valor;
    } else if (chave === 'stack') {
      p.stack = pos.slice(1).join(' ');
    } else if (chave === 'lembretes') {
      p.lembretes = ['on', 'sim', 'true', '1', 'ligado'].includes(String(valor).toLowerCase());
    } else if (chave === 'idioma') {
      p.idioma = valor;
    } else {
      throw new Error('chave deve ser: nivel | stack | lembretes | idioma');
    }
    store.gravarPerfil(p);
    return `ok: ${chave} = ${JSON.stringify(p[chave])}`;
  },

  mudancas({ flags }) {
    const limite = Number(flags.limite) || 20;
    const aqui = normalizar(process.cwd());
    const doProjeto = (r) => flags.todas || (r.cwd && normalizar(r.cwd) === aqui);

    // Fonte 1 (opcional): registros dos hooks, quando o harness tem hooks.
    const vistos = new Map();
    for (const m of store.lerLinhas('mudancas.jsonl').filter(doProjeto).reverse()) {
      if (!vistos.has(m.alvo)) vistos.set(m.alvo, m);
      if (vistos.size >= limite) break;
    }
    const cmds = store.lerLinhas('comandos.jsonl').filter(doProjeto).slice(-10);

    // Fonte 2 (universal): git status, funciona em qualquer harness.
    const git = statusGit(limite);

    if (!vistos.size && !cmds.length && !git) return 'Nenhuma mudança encontrada neste projeto.';
    const partes = [];
    if (git) partes.push('## Mudanças não commitadas (git status)', git, '');
    if (vistos.size) {
      partes.push(
        '## Arquivos editados pelo agente (mais recente primeiro)',
        ...[...vistos.values()].map((m) => `- ${m.alvo}  (${m.tipo}, ${m.ts})`),
        '',
      );
    }
    if (cmds.length) partes.push('## Últimos comandos', ...cmds.map((c) => `- \`${c.comando}\``));
    return partes.join('\n').trim();
  },

  contexto({ pos }) {
    // Tudo que um skill precisa, numa chamada só — funciona em qualquer harness.
    const blocos = { perfil: comandos.perfil, mudancas: () => comandos.mudancas({ flags: { limite: 20 } }) };
    const extras = {
      estudo: { 'Pasta de exportação': comandos['export-dir'], Trilha: comandos.trilha },
      progresso: { Trilha: comandos.trilha, 'Diário (mais recente primeiro)': () => comandos.diario({ flags: { limite: 15 } }) },
    };
    const skill = pos[0] || '';
    const saida = [blocos.perfil()];
    if (skill !== 'progresso' && skill !== 'config') saida.push(blocos.mudancas());
    for (const [titulo, fn] of Object.entries(extras[skill] || {})) saida.push(`## ${titulo}\n${fn()}`);
    return saida.join('\n\n');
  },

  registrar({ flags }) {
    const tipo = flags.tipo;
    const nota = Number(flags.nota);
    if (!TIPOS.includes(tipo)) throw new Error(`--tipo deve ser: ${TIPOS.join(' | ')}`);
    if (!Number.isFinite(nota) || nota < 0 || nota > 10) throw new Error('--nota deve ser um número de 0 a 10');

    const areasValidas = new Set(carregarTrilha('pt-BR').areas.map((a) => a.id));
    const areas = lista(flags.areas).filter((a) => areasValidas.has(a));
    const conceitos = lista(flags.conceitos);

    const p = store.lerPerfil();
    p.estatisticas[tipo].total += 1;
    p.estatisticas[tipo].somaNotas += nota;
    for (const a of areas) {
      p.areas[a] = p.areas[a] || { total: 0, somaNotas: 0 };
      p.areas[a].total += 1;
      p.areas[a].somaNotas += nota;
    }
    for (const c of conceitos) p.conceitos[c] = (p.conceitos[c] || 0) + 1;
    store.gravarPerfil(p);

    store.anexarLinha('diario.jsonl', {
      ts: new Date().toISOString(),
      projeto: path.basename(process.cwd()),
      tipo,
      nota,
      areas,
      conceitos,
      resumo: store.redigir(flags.resumo || '', 500),
    });
    return `registrado: ${tipo} nota ${nota}${areas.length ? ` · áreas: ${areas.join(', ')}` : ''}`;
  },

  trilha() {
    const p = store.lerPerfil();
    const t = carregarTrilha(p.idioma);
    const largura = Math.max(...t.areas.map((a) => a.nome.length));
    return [
      `## ${t.titulo}`,
      '',
      '```',
      ...t.areas.map((a) => {
        const s = p.areas[a.id];
        return `${a.nome.padEnd(largura)}  ${barra(media(s))}  (${s ? s.total : 0}x)  [${a.id}]`;
      }),
      '```',
      '',
      ...t.areas.map((a) => `- **${a.nome}** — ${a['espera-se']} _Conceitos:_ ${a.conceitos.join(', ')}.`),
    ].join('\n');
  },

  diario({ flags }) {
    const limite = Number(flags.limite) || 20;
    const itens = store.lerLinhas('diario.jsonl').slice(-limite).reverse();
    if (!itens.length) return 'Diário vazio — faça um /scaffold-dev:revisar ou /scaffold-dev:prever.';
    return itens
      .map((d) => `- ${d.ts.slice(0, 10)} · ${d.projeto} · ${d.tipo} ${d.nota}/10 — ${d.resumo || '(sem resumo)'}`)
      .join('\n');
  },

  'export-dir'() {
    return store.exportDir();
  },

  painel({ flags }) {
    if (flags.servir) {
      const porta = flags.porta !== undefined && flags.porta !== true ? Number(flags.porta) : 4173;
      if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
        throw new Error('--porta deve ser um número inteiro entre 0 e 65535');
      }
      const promessa = iniciarServidorPainel({ porta }).then((srv) => {
        if (flags.abrir) abrirNoNavegador(srv.url);
        return srv;
      });
      return { assincrono: true, promessa, saida: `http://127.0.0.1:${porta}` };
    }

    const { perfil, metricas } = obterMetricasAtuais();
    const html = gerarHtml(metricas, { geradoEm: new Date(), modo: 'estatico', perfil });
    const destino =
      flags.saida && flags.saida !== true
        ? path.resolve(String(flags.saida))
        : path.join(store.exportDir(), 'painel.html');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html, 'utf8');
    if (flags.abrir) abrirNoNavegador(destino);
    return destino;
  },
};

const HEADERS_PAINEL = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:",
};

function obterMetricasAtuais() {
  const perfil = store.lerPerfil();
  const diario = store.lerLinhas('diario.jsonl');
  const trilha = carregarTrilha(perfil.idioma);
  const metricas = calcularMetricas({ perfil, diario, trilha });
  return { perfil, metricas };
}

function abrirNoNavegador(alvo) {
  try {
    if (process.platform === 'win32') {
      spawnSync('cmd', ['/c', 'start', '', alvo], { stdio: 'ignore', windowsHide: true });
    } else if (process.platform === 'darwin') {
      spawnSync('open', [alvo], { stdio: 'ignore' });
    } else {
      spawnSync('xdg-open', [alvo], { stdio: 'ignore' });
    }
  } catch {
    // falha silenciosa caso nenhum navegador esteja disponível
  }
}

function tratarRequisicaoPainel(req, res) {
  let rota = '/';
  try {
    rota = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  } catch {
    rota = '/';
  }

  if (req.method === 'GET' && rota === '/') {
    const { perfil, metricas } = obterMetricasAtuais();
    const html = gerarHtml(metricas, { geradoEm: new Date(), modo: 'servidor', perfil });
    res.writeHead(200, {
      ...HEADERS_PAINEL,
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && rota === '/api/metricas') {
    const { metricas } = obterMetricasAtuais();
    res.writeHead(200, {
      ...HEADERS_PAINEL,
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(metricas));
    return;
  }

  res.writeHead(404, {
    ...HEADERS_PAINEL,
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Não encontrado');
}

function iniciarServidorPainel({ porta = 4173, maxTentativas = 10 } = {}) {
  const portaInicial = Number.isFinite(Number(porta)) && Number(porta) >= 0 ? Number(porta) : 4173;
  const servidor = http.createServer(tratarRequisicaoPainel);

  return new Promise((resolve, reject) => {
    let tentativa = 0;

    function tentar(portaAlvo) {
      function aoErro(err) {
        servidor.removeListener('listening', aoEscutar);
        if (err && err.code === 'EADDRINUSE' && portaInicial > 0 && tentativa < maxTentativas) {
          tentativa += 1;
          tentar(portaInicial + tentativa);
        } else {
          reject(err);
        }
      }

      function aoEscutar() {
        servidor.removeListener('error', aoErro);
        const endereco = servidor.address();
        const portaReal = endereco && typeof endereco === 'object' ? endereco.port : portaAlvo;
        const url = `http://127.0.0.1:${portaReal}`;
        servidor.porta = portaReal;
        servidor.url = url;
        servidor.fechar = () => new Promise((r) => servidor.close(r));
        Object.defineProperty(servidor, 'servidor', { value: servidor, enumerable: false });
        resolve(servidor);
      }

      servidor.once('error', aoErro);
      servidor.once('listening', aoEscutar);
      servidor.listen(portaAlvo, '127.0.0.1');
    }

    tentar(portaInicial);
  });
}

function main(argv) {
  const { pos, flags } = args(argv);
  const nome = pos.shift();
  const cmd = comandos[nome];
  if (!cmd) {
    return { codigo: 1, saida: `comando desconhecido: ${nome || '(vazio)'}\nuse: ${Object.keys(comandos).join(' | ')}` };
  }
  try {
    const res = cmd({ pos, flags });
    if (res && typeof res === 'object' && res.assincrono) {
      return { codigo: 0, saida: res.saida, promessa: res.promessa };
    }
    return { codigo: 0, saida: res };
  } catch (e) {
    return { codigo: 1, saida: `erro: ${e.message}` };
  }
}

if (require.main === module) {
  const res = main(process.argv.slice(2));
  if (res.promessa) {
    res.promessa
      .then((srv) => {
        process.stdout.write(`${srv.url}\n`);
        const encerrar = () => srv.close(() => process.exit(0));
        process.once('SIGINT', encerrar);
        process.once('SIGTERM', encerrar);
      })
      .catch((e) => {
        process.stderr.write(`erro: ${e.message}\n`);
        process.exit(1);
      });
  } else {
    (res.codigo ? process.stderr : process.stdout).write(res.saida + '\n');
    process.exit(res.codigo);
  }
}

module.exports = { main, iniciarServidorPainel };
