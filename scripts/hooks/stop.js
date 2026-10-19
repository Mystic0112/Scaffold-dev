#!/usr/bin/env node
'use strict';

// Hook "o agente terminou a resposta": se a resposta mexeu em arquivos, sugere
// (no máximo a cada INTERVALO_MS) uma atividade de estudo sobre essas mudanças.
// Só mostra mensagem ao usuário — não injeta nada no contexto do agente.
//
//   node stop.js [--formato json|copilot|texto] [--harness claude|codex|...]
//   json    → {"systemMessage": "..."}           (Claude Code, Codex, Gemini CLI, VS Code)
//   copilot → {"type":"progress","message":"..."} (Copilot CLI)
//   texto   → a mensagem pura                    (plugins JS do OpenCode e do Amp)

const store = require('../lib/store');
const { lerEntrada } = require('../lib/stdin');
const { normalizar } = require('../lib/payload');

const INTERVALO_MS = 15 * 60 * 1000;

// Como o usuário chama um skill em cada harness.
const INVOCAR = {
  claude: (s) => `/scaffold-dev:${s}`,
  codex: (s) => `$scaffold-dev-${s}`,
  copilot: (s) => `/scaffold-dev-${s}`,
};
const invocacaoPadrao = (s) => `skill scaffold-dev-${s}`;

const SUGESTOES = [
  (n, i) => `${n} arquivo(s) mudaram. Treine code review: ${i('revisar')}`,
  (n, i) => `${n} arquivo(s) mudaram. Entendeu tudo? ${i('explicar')}`,
  (n, i) => `${n} arquivo(s) mudaram. Gere material p/ NotebookLM ou SurfSense: ${i('estudo')}`,
  (n, i) => `Na próxima tarefa, tente prever a solução antes: ${i('prever')}`,
];

function sugestao(entrada, perfil, { agora = Date.now(), harness = 'claude' } = {}) {
  if (entrada.stop_hook_active || !perfil.lembretes) return null;
  if (agora - (perfil.ultimoLembrete || 0) < INTERVALO_MS) return null;

  const sessao = normalizar(entrada).sessao;
  const desde = perfil.ultimoLembrete || 0;
  const arquivos = new Set(
    store
      .lerLinhas('mudancas.jsonl')
      .filter((m) => (!sessao || m.sessao === sessao) && Date.parse(m.ts) > desde)
      .map((m) => m.alvo),
  );
  if (arquivos.size === 0) return null;

  const i = Math.floor(agora / 1000) % SUGESTOES.length;
  return `🥋 Scaffold Dev — ${SUGESTOES[i](arquivos.size, INVOCAR[harness] || invocacaoPadrao)}`;
}

function formatar(msg, formato) {
  if (formato === 'texto') return msg;
  if (formato === 'copilot') return JSON.stringify({ type: 'progress', message: msg });
  return JSON.stringify({ systemMessage: msg });
}

function flag(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

async function main() {
  const entrada = await lerEntrada();
  const perfil = store.lerPerfil();
  const msg = sugestao(entrada, perfil, { harness: flag('harness', 'claude') });
  if (!msg) return;
  perfil.ultimoLembrete = Date.now();
  store.gravarPerfil(perfil);
  process.stdout.write(formatar(msg, flag('formato', 'json')));
}

if (require.main === module) {
  main().catch(() => {}).finally(() => process.exit(0));
}

module.exports = { sugestao, formatar, INTERVALO_MS };
