#!/usr/bin/env node
'use strict';

// Stop: quando o Claude termina uma resposta que mexeu em arquivos, sugere
// (no máximo a cada INTERVALO_MS) uma atividade de estudo sobre essas mudanças.
// Só mostra mensagem ao usuário — não injeta nada no contexto do Claude.

const store = require('../lib/store');
const { lerEntrada } = require('../lib/stdin');

const INTERVALO_MS = 15 * 60 * 1000;

const SUGESTOES = [
  (n) => `${n} arquivo(s) mudaram. Treine code review: /scaffold-dev:revisar`,
  (n) => `${n} arquivo(s) mudaram. Entendeu tudo? /scaffold-dev:explicar`,
  (n) => `${n} arquivo(s) mudaram. Gere material p/ NotebookLM ou SurfSense: /scaffold-dev:estudo`,
  () => `Na próxima tarefa, tente prever a solução antes: /scaffold-dev:prever <tarefa>`,
];

function sugestao(entrada, perfil, agora = Date.now()) {
  if (entrada.stop_hook_active || !perfil.lembretes) return null;
  if (agora - (perfil.ultimoLembrete || 0) < INTERVALO_MS) return null;

  const desde = perfil.ultimoLembrete || 0;
  const arquivos = new Set(
    store
      .lerLinhas('mudancas.jsonl')
      .filter((m) => m.sessao === entrada.session_id && Date.parse(m.ts) > desde)
      .map((m) => m.alvo),
  );
  if (arquivos.size === 0) return null;

  const i = Math.floor(agora / 1000) % SUGESTOES.length;
  return `🥋 Scaffold Dev — ${SUGESTOES[i](arquivos.size)}`;
}

async function main() {
  const entrada = await lerEntrada();
  const perfil = store.lerPerfil();
  const msg = sugestao(entrada, perfil);
  if (!msg) return;
  perfil.ultimoLembrete = Date.now();
  store.gravarPerfil(perfil);
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

if (require.main === module) {
  main().catch(() => {}).finally(() => process.exit(0));
}

module.exports = { sugestao, INTERVALO_MS };
