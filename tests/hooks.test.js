'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');
const { registro } = require('../scripts/hooks/post-tool');
const { sugestao, INTERVALO_MS } = require('../scripts/hooks/stop');

test.beforeEach(() => dirTemporario());

test('post-tool registra edição sem guardar conteúdo', () => {
  const r = registro({
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
  const r = registro({ tool_name: 'Bash', tool_input: { command: 'TOKEN=abc123456 npm run deploy' } });
  assert.ok(!r.linha.comando.includes('abc123456'));
  assert.strictEqual(registro({ tool_name: 'Read', tool_input: { file_path: '/x' } }), null);
});

test('post-tool como processo: lê stdin, grava e sai com 0', () => {
  const script = path.join(__dirname, '..', 'scripts', 'hooks', 'post-tool.js');
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/p/b.js' }, session_id: 's', cwd: '/p' });
  const res = spawnSync(process.execPath, [script], { input: entrada, env: process.env });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(store.lerLinhas('mudancas.jsonl')[0].alvo, '/p/b.js');
});

test('post-tool não quebra com stdin inválido', () => {
  const script = path.join(__dirname, '..', 'scripts', 'hooks', 'post-tool.js');
  const res = spawnSync(process.execPath, [script], { input: 'não é json', env: process.env });
  assert.strictEqual(res.status, 0);
});

test('stop sugere estudo só quando houve mudanças e respeita intervalo', () => {
  const perfil = store.lerPerfil();
  assert.strictEqual(sugestao({ session_id: 's1' }, perfil), null, 'sem mudanças não sugere');

  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), sessao: 's1', alvo: '/p/a.js' });
  const msg = sugestao({ session_id: 's1' }, perfil);
  assert.match(msg, /Scaffold Dev/);

  assert.strictEqual(sugestao({ session_id: 'outra' }, perfil), null, 'outra sessão não conta');
  assert.strictEqual(sugestao({ session_id: 's1', stop_hook_active: true }, perfil), null);
  assert.strictEqual(sugestao({ session_id: 's1' }, { ...perfil, lembretes: false }), null);

  const recente = { ...perfil, ultimoLembrete: Date.now() - INTERVALO_MS / 2 };
  assert.strictEqual(sugestao({ session_id: 's1' }, recente), null, 'respeita intervalo');
});

test('stop como processo emite systemMessage em JSON', () => {
  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), sessao: 's9', alvo: '/p/a.js' });
  const script = path.join(__dirname, '..', 'scripts', 'hooks', 'stop.js');
  const res = spawnSync(process.execPath, [script], { input: JSON.stringify({ session_id: 's9' }), env: process.env });
  assert.strictEqual(res.status, 0);
  assert.match(JSON.parse(res.stdout.toString()).systemMessage, /Scaffold Dev/);
  assert.ok(store.lerPerfil().ultimoLembrete > 0);
});
