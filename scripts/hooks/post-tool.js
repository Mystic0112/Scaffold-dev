#!/usr/bin/env node
'use strict';

// PostToolUse: registra QUAIS arquivos mudaram e quais comandos rodaram.
// Não guarda conteúdo de código — só caminho, ferramenta e comando redigido.
// Nunca deve atrapalhar o trabalho do agente: qualquer erro é engolido.

const store = require('../lib/store');
const { lerEntrada } = require('../lib/stdin');

const FERRAMENTAS_DE_EDICAO = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

function registro(entrada) {
  const { tool_name: ferramenta, tool_input: input = {}, session_id: sessao, cwd } = entrada;
  const base = { ts: new Date().toISOString(), sessao, cwd, ferramenta };

  if (FERRAMENTAS_DE_EDICAO.has(ferramenta)) {
    const arquivo = input.file_path || input.notebook_path;
    if (!arquivo) return null;
    const tipo = ferramenta === 'Write' ? 'escrita' : 'edicao';
    return { arquivo: 'mudancas.jsonl', linha: { ...base, tipo, alvo: arquivo } };
  }
  if (ferramenta === 'Bash' || ferramenta === 'PowerShell') {
    if (!input.command) return null;
    return { arquivo: 'comandos.jsonl', linha: { ...base, comando: store.redigir(input.command) } };
  }
  return null;
}

async function main() {
  const entrada = await lerEntrada();
  const r = registro(entrada);
  if (r) store.anexarLinha(r.arquivo, r.linha);
}

if (require.main === module) {
  main().catch(() => {}).finally(() => process.exit(0));
}

module.exports = { registro };
