'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizar } = require('../scripts/lib/payload');

// Payloads de exemplo no formato documentado de cada harness.
const CASOS = [
  ['Claude Code Edit', { tool_name: 'Edit', tool_input: { file_path: '/p/a.js' }, session_id: 's', cwd: '/p' }, { tipo: 'edicao', arquivos: ['/p/a.js'], sessao: 's', cwd: '/p' }],
  ['Claude Code Bash', { tool_name: 'Bash', tool_input: { command: 'npm test' } }, { tipo: 'comando', comando: 'npm test' }],
  ['Codex apply_patch (command)', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: src/a.js\n@@\n*** Add File: src/b.js\n*** End Patch' } }, { tipo: 'edicao', arquivos: ['src/a.js', 'src/b.js'] }],
  ['Codex apply_patch (input)', { tool_name: 'apply_patch', tool_input: { input: '*** Delete File: velho.js' } }, { tipo: 'edicao', arquivos: ['velho.js'] }],
  ['Copilot CLI edit (toolArgs string)', { toolName: 'edit', toolArgs: '{"path":"/p/c.ts"}', sessionId: 'c1', cwd: '/p' }, { tipo: 'edicao', arquivos: ['/p/c.ts'], sessao: 'c1' }],
  ['Copilot CLI bash (toolArgs objeto)', { toolName: 'bash', toolArgs: { command: 'ls' } }, { tipo: 'comando', comando: 'ls' }],
  ['Copilot CLI powershell', { toolName: 'powershell', toolArgs: '{"command":"dir"}' }, { tipo: 'comando', comando: 'dir' }],
  ['Gemini write_file', { hook_event_name: 'AfterTool', tool_name: 'write_file', tool_input: { file_path: '/p/d.py' } }, { tipo: 'edicao', arquivos: ['/p/d.py'] }],
  ['Gemini replace', { tool_name: 'replace', tool_input: { file_path: '/p/d.py', old_string: 'a' } }, { tipo: 'edicao', arquivos: ['/p/d.py'] }],
  ['Gemini run_shell_command', { tool_name: 'run_shell_command', tool_input: { command: 'pytest' } }, { tipo: 'comando', comando: 'pytest' }],
  ['Cursor afterFileEdit', { hook_event_name: 'afterFileEdit', file_path: '/p/e.tsx', conversation_id: 'k', workspace_roots: ['/p'] }, { tipo: 'edicao', arquivos: ['/p/e.tsx'], sessao: 'k', cwd: '/p' }],
  ['Cursor afterShellExecution', { hook_event_name: 'afterShellExecution', command: 'pnpm build' }, { tipo: 'comando', comando: 'pnpm build' }],
  ['Cursor postToolUse Shell', { hook_event_name: 'postToolUse', tool_name: 'Shell', tool_input: { command: 'git status' } }, { tipo: 'comando', comando: 'git status' }],
  ['Windsurf post_write_code', { agent_action_name: 'post_write_code', trajectory_id: 't', tool_info: { file_path: '/p/f.go' } }, { tipo: 'edicao', arquivos: ['/p/f.go'], sessao: 't' }],
  ['Windsurf post_run_command', { agent_action_name: 'post_run_command', tool_info: { command_line: 'go test ./...', cwd: '/p' } }, { tipo: 'comando', comando: 'go test ./...', cwd: '/p' }],
  ['Goose AfterFileEdit', { event: 'AfterFileEdit', tool_name: 'write', tool_input: { path: '/p/g.rs' }, working_dir: '/p' }, { tipo: 'edicao', arquivos: ['/p/g.rs'], cwd: '/p' }],
  ['OpenCode edit (via plugin)', { tool_name: 'edit', tool_input: { filePath: '/p/h.js' } }, { tipo: 'edicao', arquivos: ['/p/h.js'] }],
  ['OpenCode apply_patch (via plugin)', { tool_name: 'apply_patch', tool_input: { patchText: '*** Update File: x.js' } }, { tipo: 'edicao', arquivos: ['x.js'] }],
];

for (const [nome, entrada, esperado] of CASOS) {
  test(`normaliza ${nome}`, () => {
    const n = normalizar(entrada);
    for (const [chave, valor] of Object.entries(esperado)) assert.deepStrictEqual(n[chave], valor, `${chave} em ${nome}`);
  });
}

test('ignora leituras e entradas vazias', () => {
  for (const e of [
    {},
    { tool_name: 'Read', tool_input: { file_path: '/x' } },
    { tool_name: 'read_file', tool_input: { file_path: '/x' } },
    { tool_name: 'NotebookRead', tool_input: { notebook_path: '/x' } },
    { tool_name: 'Grep', tool_input: { pattern: 'x' } },
    { tool_name: 'Edit', tool_input: {} },
    { toolName: 'bash', toolArgs: 'não é json' },
  ]) {
    assert.strictEqual(normalizar(e).tipo, null, JSON.stringify(e));
  }
});
