#!/usr/bin/env node
'use strict';

// Hook "depois de usar uma ferramenta": registra QUAIS arquivos mudaram e quais comandos rodaram.
// Funciona com o JSON de qualquer harness suportado (veja lib/payload.js).
// Não guarda conteúdo de código — só caminho e comando redigido.
// Nunca deve atrapalhar o trabalho do agente: qualquer erro é engolido.

const store = require('../lib/store');
const { lerEntrada } = require('../lib/stdin');
const { normalizar } = require('../lib/payload');

function registros(entrada) {
  const n = normalizar(entrada);
  const base = { ts: new Date().toISOString(), sessao: n.sessao, cwd: n.cwd, ferramenta: n.ferramenta };
  if (n.tipo === 'edicao') {
    return n.arquivos.map((alvo) => ({ arquivo: 'mudancas.jsonl', linha: { ...base, tipo: 'edicao', alvo } }));
  }
  if (n.tipo === 'comando') {
    return [{ arquivo: 'comandos.jsonl', linha: { ...base, comando: store.redigir(n.comando) } }];
  }
  return [];
}

async function main() {
  const entrada = await lerEntrada();
  for (const r of registros(entrada)) store.anexarLinha(r.arquivo, r.linha);
}

if (require.main === module) {
  main().catch(() => {}).finally(() => process.exit(0));
}

module.exports = { registros };
