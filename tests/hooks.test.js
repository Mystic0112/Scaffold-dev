'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');
const { registros } = require('../scripts/hooks/post-tool');
const { sugestao, formatar, INTERVALO_MS } = require('../scripts/hooks/stop');

const HOOKS = path.join(__dirname, '..', 'scripts', 'hooks');

test.beforeEach(() => dirTemporario());

test('post-tool registra edição sem guardar conteúdo', () => {
  const [r] = registros({
    tool_name: 'Edit',
    tool_input: { file_path: '/p/a.js', old_string: 'SEGREDO', new_string: 'x' },
    session_id: 's1',
    cwd: '/p',
  });
  assert.strictEqual(r.arquivo, 'mudancas.jsonl');
  assert.strictEqual(r.linha.alvo, '/p/a.js');
  assert.ok(!JSON.stringify(r).includes('SEGREDO'));
});

test('post-tool redige comandos e ignora ferramentas de leitura', () => {
  const [r] = registros({ tool_name: 'Bash', tool_input: { command: 'TOKEN=abc123456 npm run deploy' } });
  assert.ok(!r.linha.comando.includes('abc123456'));
  assert.deepStrictEqual(registros({ tool_name: 'Read', tool_input: { file_path: '/x' } }), []);
});

test('post-tool como processo: lê stdin, grava e sai com 0', () => {
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/p/b.js' }, session_id: 's', cwd: '/p' });
  const res = spawnSync(process.execPath, [path.join(HOOKS, 'post-tool.js')], { input: entrada, env: process.env });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(store.lerLinhas('mudancas.jsonl')[0].alvo, '/p/b.js');
});

test('post-tool não quebra com stdin inválido', () => {
  const res = spawnSync(process.execPath, [path.join(HOOKS, 'post-tool.js')], { input: 'não é json', env: process.env });
  assert.strictEqual(res.status, 0);
});

test('stop sugere estudo só quando houve mudanças e respeita intervalo', () => {
  const perfil = store.lerPerfil();
  assert.strictEqual(sugestao({ session_id: 's1' }, perfil), null, 'sem mudanças não sugere');

  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), sessao: 's1', alvo: '/p/a.js' });
  assert.match(sugestao({ session_id: 's1' }, perfil), /Scaffold Dev/);

  assert.strictEqual(sugestao({ session_id: 'outra' }, perfil), null, 'outra sessão não conta');
  assert.strictEqual(sugestao({ session_id: 's1', stop_hook_active: true }, perfil), null);
  assert.strictEqual(sugestao({ session_id: 's1' }, { ...perfil, lembretes: false }), null);

  const recente = { ...perfil, ultimoLembrete: Date.now() - INTERVALO_MS / 2 };
  assert.strictEqual(sugestao({ session_id: 's1' }, recente), null, 'respeita intervalo');
});

test('stop usa a sintaxe de invocação de cada harness', () => {
  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), sessao: 's1', alvo: '/p/a.js' });
  const perfil = store.lerPerfil();
  const agora = 1000 * 4000; // fixa a sugestão (índice 0 → revisar)
  assert.match(sugestao({ session_id: 's1' }, perfil, { agora, harness: 'claude' }), /\/scaffold-dev:revisar/);
  assert.match(sugestao({ session_id: 's1' }, perfil, { agora, harness: 'codex' }), /\$scaffold-dev-revisar/);
  assert.match(sugestao({ sessionId: 's1' }, perfil, { agora, harness: 'gemini' }), /skill scaffold-dev-revisar/);
});

test('stop formata a saída para cada harness', () => {
  assert.deepStrictEqual(JSON.parse(formatar('oi', 'json')), { systemMessage: 'oi' });
  assert.deepStrictEqual(JSON.parse(formatar('oi', 'copilot')), { type: 'progress', message: 'oi' });
  assert.strictEqual(formatar('oi', 'texto'), 'oi');
});

test('stop como processo emite systemMessage em JSON', () => {
  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), sessao: 's9', alvo: '/p/a.js' });
  const res = spawnSync(process.execPath, [path.join(HOOKS, 'stop.js')], { input: JSON.stringify({ session_id: 's9' }), env: process.env });
  assert.strictEqual(res.status, 0);
  assert.match(JSON.parse(res.stdout.toString()).systemMessage, /Scaffold Dev/);
  assert.ok(store.lerPerfil().ultimoLembrete > 0);
});
