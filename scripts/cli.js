#!/usr/bin/env node
'use strict';

// CLI usada pelos skills do plugin (e por você, se quiser):
//   node cli.js perfil
//   node cli.js config <nivel|stack|lembretes|idioma> <valor>
//   node cli.js mudancas [--limite 20] [--todas]
//   node cli.js registrar --tipo <previsao|revisao|explicacao> --nota <0-10> [--areas a,b] [--conceitos "x,y"] [--resumo "..."]
//   node cli.js trilha
//   node cli.js diario [--limite 20]
//   node cli.js export-dir

const fs = require('fs');
const path = require('path');
const store = require('./lib/store');

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

    const vistos = new Map();
    for (const m of store.lerLinhas('mudancas.jsonl').filter(doProjeto).reverse()) {
      if (!vistos.has(m.alvo)) vistos.set(m.alvo, m);
      if (vistos.size >= limite) break;
    }
    const cmds = store.lerLinhas('comandos.jsonl').filter(doProjeto).slice(-10);

    if (!vistos.size && !cmds.length) return 'Nenhuma mudança registrada neste projeto ainda.';
    return [
      '## Arquivos alterados recentemente (mais recente primeiro)',
      ...[...vistos.values()].map((m) => `- ${m.alvo}  (${m.tipo}, ${m.ts})`),
      '',
      '## Últimos comandos',
      ...(cmds.length ? cmds.map((c) => `- \`${c.comando}\``) : ['- nenhum']),
    ].join('\n');
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
};

function main(argv) {
  const { pos, flags } = args(argv);
  const nome = pos.shift();
  const cmd = comandos[nome];
  if (!cmd) {
    return { codigo: 1, saida: `comando desconhecido: ${nome || '(vazio)'}\nuse: ${Object.keys(comandos).join(' | ')}` };
  }
  try {
    return { codigo: 0, saida: cmd({ pos, flags }) };
  } catch (e) {
    return { codigo: 1, saida: `erro: ${e.message}` };
  }
}

if (require.main === module) {
  const { codigo, saida } = main(process.argv.slice(2));
  (codigo ? process.stderr : process.stdout).write(saida + '\n');
  process.exit(codigo);
}

module.exports = { main };
