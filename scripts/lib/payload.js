'use strict';

// Cada harness manda o JSON do hook num formato diferente. Aqui tudo vira:
//   { tipo: 'edicao' | 'comando' | null, arquivos: [...], comando, sessao, cwd }
//
// Formatos cobertos (pesquisados em out/2026):
//   Claude Code, Codex, VS Code, Gemini CLI, Kiro, Goose → tool_name + tool_input
//   Copilot CLI                                      → toolName + toolArgs (string JSON ou objeto)
//   Cursor (afterFileEdit / afterShellExecution)     → file_path / command no topo
//   Windsurf (post_write_code / post_run_command)    → tool_info.file_path / tool_info.command_line

const EVENTOS_EDICAO = /^(afterFileEdit|AfterFileEdit|post_write_code|PostFileSave)$/;
const EVENTOS_COMANDO = /^(afterShellExecution|AfterShellExecution|post_run_command)$/;
const NOME_EDICAO = /write|edit|create|replace|patch|notebook/i;
const NOME_COMANDO = /bash|shell|powershell|terminal|command/i;
const NOME_LEITURA = /read/i; // NotebookRead, read_terminal, read_file…

function objeto(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v);
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

// Codex manda edições como patch: "*** Update File: caminho"
function arquivosDoPatch(texto) {
  if (typeof texto !== 'string') return [];
  const arquivos = [];
  for (const m of texto.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)) arquivos.push(m[1].trim());
  return arquivos;
}

function caminhoDe(o) {
  return o.file_path || o.filePath || o.path || o.notebook_path || o.target_file || null;
}

function normalizar(e = {}) {
  const info = objeto(e.tool_info);
  const nome = e.tool_name || e.toolName || e.tool || '';
  const input = objeto(e.tool_input || e.toolArgs || e.args);
  const evento = e.hook_event_name || e.agent_action_name || e.event || '';

  const base = {
    sessao: e.session_id || e.sessionId || e.conversation_id || e.trajectory_id || null,
    cwd: e.cwd || info.cwd || e.working_dir || (Array.isArray(e.workspace_roots) && e.workspace_roots[0]) || null,
  };

  // Eventos que já dizem o que aconteceu (Cursor, Windsurf, Goose, Kiro)
  if (EVENTOS_EDICAO.test(evento)) {
    const alvo = e.file_path || caminhoDe(info) || caminhoDe(input);
    return { ...base, tipo: alvo ? 'edicao' : null, arquivos: alvo ? [alvo] : [] };
  }
  if (EVENTOS_COMANDO.test(evento)) {
    const comando = e.command || info.command_line || input.command || null;
    return { ...base, tipo: comando ? 'comando' : null, comando };
  }

  if (!nome || NOME_LEITURA.test(nome)) return { ...base, tipo: null };

  if (NOME_EDICAO.test(nome)) {
    const direto = caminhoDe(input);
    const arquivos = direto ? [direto] : arquivosDoPatch(input.command || input.input || input.patchText || input.patch);
    return { ...base, tipo: arquivos.length ? 'edicao' : null, arquivos, ferramenta: nome };
  }
  if (NOME_COMANDO.test(nome) && typeof input.command === 'string') {
    return { ...base, tipo: 'comando', comando: input.command, ferramenta: nome };
  }
  return { ...base, tipo: null };
}

module.exports = { normalizar, arquivosDoPatch };
