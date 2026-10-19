'use strict';

// Armazenamento local do Scaffold Dev. Nada sai da máquina.
// Diretório: $SCAFFOLD_DEV_HOME > ~/.scaffold-dev — o mesmo para todos os harnesses,
// para que o progresso no Claude Code, Codex, Cursor etc. fique num perfil só.

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_LINHAS = 1000;

const PERFIL_PADRAO = {
  versao: 1,
  idioma: 'pt-BR',
  nivel: 'junior', // estagiario | junior | pleno
  stack: '',
  lembretes: true,
  criadoEm: null,
  ultimoLembrete: 0,
  estatisticas: {
    previsao: { total: 0, somaNotas: 0 },
    revisao: { total: 0, somaNotas: 0 },
    explicacao: { total: 0, somaNotas: 0 },
  },
  areas: {}, // id da área -> { total, somaNotas }
  conceitos: {}, // nome do conceito -> vezes estudado
};

function dataDir() {
  const dir = process.env.SCAFFOLD_DEV_HOME || path.join(os.homedir(), '.scaffold-dev');
  fs.mkdirSync(dir, { recursive: true });
  migrarDadosDoPlugin(dir);
  return dir;
}

// A v0.1.0 guardava os dados em $CLAUDE_PLUGIN_DATA. Copia uma vez para o diretório comum.
function migrarDadosDoPlugin(dir) {
  const antigo = process.env.CLAUDE_PLUGIN_DATA;
  if (!antigo || process.env.SCAFFOLD_DEV_HOME || path.resolve(antigo) === path.resolve(dir)) return;
  if (fs.existsSync(path.join(dir, 'perfil.json')) || !fs.existsSync(path.join(antigo, 'perfil.json'))) return;
  for (const nome of ['perfil.json', 'diario.jsonl', 'mudancas.jsonl', 'comandos.jsonl']) {
    try {
      fs.copyFileSync(path.join(antigo, nome), path.join(dir, nome));
    } catch {
      // arquivo não existia na versão antiga
    }
  }
}

function exportDir() {
  const dir =
    process.env.SCAFFOLD_DEV_EXPORT_DIR ||
    path.join(os.homedir(), 'scaffold-dev-estudos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function arquivo(nome) {
  return path.join(dataDir(), nome);
}

function lerJson(nome, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo(nome), 'utf8'));
  } catch {
    return padrao;
  }
}

function gravarJson(nome, valor) {
  const destino = arquivo(nome);
  const tmp = destino + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2));
  fs.renameSync(tmp, destino);
}

function lerPerfil() {
  const salvo = lerJson('perfil.json', null);
  const perfil = structuredClone(PERFIL_PADRAO);
  if (salvo) {
    Object.assign(perfil, salvo);
    perfil.estatisticas = { ...structuredClone(PERFIL_PADRAO.estatisticas), ...salvo.estatisticas };
  } else {
    perfil.criadoEm = new Date().toISOString();
  }
  return perfil;
}

function gravarPerfil(perfil) {
  gravarJson('perfil.json', perfil);
}

function anexarLinha(nome, obj, max = MAX_LINHAS) {
  const destino = arquivo(nome);
  fs.appendFileSync(destino, JSON.stringify(obj) + '\n');
  const linhas = fs.readFileSync(destino, 'utf8').split('\n').filter(Boolean);
  if (linhas.length > max) {
    fs.writeFileSync(destino, linhas.slice(-max).join('\n') + '\n');
  }
}

function lerLinhas(nome) {
  try {
    return fs
      .readFileSync(arquivo(nome), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// [padrão, substituto] — o substituto preserva o prefixo (ex.: "senha=") e esconde o valor.
const PADROES_SEGREDO = [
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{10,}/g, '***'], // chaves estilo OpenAI/Stripe/Anthropic
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '***'], // tokens GitHub
  [/\bAKIA[0-9A-Z]{16}\b/g, '***'], // AWS access key
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '***'], // Slack
  [/(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1***'],
  [/((?:password|passwd|senha|secret|token|api[_-]?key)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1***'],
  [/(--(?:password|token|secret|api-key)[= ])\S+/gi, '$1***'],
  [/(:\/\/[^:/\s]+:)[^@\s]+@/g, '$1***@'], // usuario:senha@host
];

function redigir(texto, max = 200) {
  let s = String(texto || '');
  for (const [padrao, substituto] of PADROES_SEGREDO) s = s.replace(padrao, substituto);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

module.exports = {
  PERFIL_PADRAO,
  dataDir,
  exportDir,
  lerPerfil,
  gravarPerfil,
  anexarLinha,
  lerLinhas,
  redigir,
};
