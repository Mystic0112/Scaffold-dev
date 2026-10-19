'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');
const { HARNESSES, MARCA } = require('../scripts/lib/harnesses');
const { instalar, main, MARCA_SKILL } = require('../scripts/install');

let casa;
const env = { ...process.env };

test.beforeEach(() => {
  const projeto = dirTemporario();
  casa = path.join(path.dirname(projeto), 'casa');
  fs.mkdirSync(casa);
  process.env.HOME = casa;
  process.env.USERPROFILE = casa;
  // simula uma máquina com todos os harnesses instalados
  for (const h of Object.values(HARNESSES)) fs.mkdirSync(h.detectar(), { recursive: true });
});

test.afterEach(() => {
  process.env.HOME = env.HOME;
  process.env.USERPROFILE = env.USERPROFILE;
});

test('todo caminho usado é calculado a partir do HOME atual (nunca no carregamento)', () => {
  for (const [id, h] of Object.entries(HARNESSES)) {
    const caminhos = [h.detectar()];
    if (typeof h.skills === 'function') caminhos.push(h.skills());
    if (h.hooks) caminhos.push(h.hooks('/raiz').arquivo);
    for (const c of caminhos) assert.ok(c.startsWith(casa), `${id}: ${c} fora do HOME de teste`);
  }
});

const ler = (...p) => fs.readFileSync(path.join(casa, ...p), 'utf8');
const lerJson = (...p) => JSON.parse(ler(...p));

test('"todos" instala skills na pasta comum e nas pastas próprias', () => {
  const { codigo, saida } = main(['todos']);
  assert.strictEqual(codigo, 0, saida);

  for (const pasta of [['.agents', 'skills'], ['.kiro', 'skills'], ['.cline', 'skills'], ['.gemini', 'antigravity-cli', 'skills']]) {
    const skill = ler(...pasta, 'scaffold-dev-revisar', 'SKILL.md');
    assert.match(skill, /^---\nname: scaffold-dev-revisar\ndescription: "/);
    assert.ok(skill.includes(MARCA_SKILL));
    assert.ok(!skill.includes('${CLAUDE_PLUGIN_ROOT}'));
    assert.match(skill, /scripts\/cli\.js" contexto revisar/);
  }
  assert.ok(!fs.existsSync(path.join(casa, '.claude', 'skills')), 'Claude Code usa o plugin nativo');
  assert.match(saida, /plugin marketplace add/);
});

test('hooks de cada harness são escritos no formato dele', () => {
  main(['todos']);
  assert.deepStrictEqual(Object.keys(lerJson('.codex', 'hooks.json').hooks), ['PostToolUse', 'Stop']);
  assert.deepStrictEqual(Object.keys(lerJson('.gemini', 'settings.json').hooks), ['AfterTool', 'AfterAgent']);
  assert.deepStrictEqual(Object.keys(lerJson('.cursor', 'hooks.json').hooks), ['afterFileEdit', 'afterShellExecution']);
  assert.deepStrictEqual(Object.keys(lerJson('.codeium', 'windsurf', 'hooks.json').hooks), ['post_write_code', 'post_run_command']);
  const copilot = lerJson('.copilot', 'hooks', 'scaffold-dev.json');
  assert.strictEqual(copilot.version, 1);
  assert.match(copilot.hooks.agentStop[0].powershell, /--formato copilot/);
  assert.strictEqual(lerJson('.kiro', 'hooks', 'scaffold-dev.json').hooks.length, 2);
  assert.match(ler('.config', 'opencode', 'plugins', 'scaffold-dev.js'), /tool\.execute\.after/);
  assert.match(ler('.config', 'amp', 'plugins', 'scaffold-dev.ts'), /amp\.on\("tool\.result"/);
});

test('preserva config existente, faz backup e é idempotente', () => {
  const arquivo = path.join(casa, '.gemini', 'settings.json');
  const original = { theme: 'dark', hooks: { AfterTool: [{ matcher: 'x', hooks: [{ type: 'command', command: 'meu-hook' }] }] } };
  fs.writeFileSync(arquivo, JSON.stringify(original));

  main(['gemini']);
  main(['gemini']); // de novo: não pode duplicar
  const cfg = lerJson('.gemini', 'settings.json');
  assert.strictEqual(cfg.theme, 'dark');
  assert.strictEqual(cfg.hooks.AfterTool.length, 2, 'o hook do usuário + o nosso, sem duplicar');
  assert.strictEqual(cfg.hooks.AfterTool[0].hooks[0].command, 'meu-hook');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(arquivo + '.antes-scaffold-dev.bak', 'utf8')), original);

  main(['gemini', '--desinstalar']);
  assert.deepStrictEqual(lerJson('.gemini', 'settings.json'), original);
});

test('desinstalar remove só o que é nosso', () => {
  const minha = path.join(casa, '.agents', 'skills', 'minha-skill');
  fs.mkdirSync(minha, { recursive: true });
  fs.writeFileSync(path.join(minha, 'SKILL.md'), '---\nname: minha-skill\n---\n');

  main(['todos']);
  const { codigo } = main(['todos', '--desinstalar']);
  assert.strictEqual(codigo, 0);
  assert.deepStrictEqual(fs.readdirSync(path.join(casa, '.agents', 'skills')), ['minha-skill']);
  assert.ok(!fs.existsSync(path.join(casa, '.copilot', 'hooks', 'scaffold-dev.json')));
  assert.ok(!fs.existsSync(path.join(casa, '.config', 'opencode', 'plugins', 'scaffold-dev.js')));
  assert.ok(!('hooks' in lerJson('.codex', 'hooks.json')));
});

test('recusa mexer em JSON inválido e em arquivos que não são nossos', () => {
  fs.writeFileSync(path.join(casa, '.cursor', 'hooks.json'), '{ isso não é json');
  fs.mkdirSync(path.join(casa, '.copilot', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(casa, '.copilot', 'hooks', 'scaffold-dev.json'), '{"meu":"arquivo"}');

  const { log } = instalar({ alvos: ['cursor', 'copilot'] });
  assert.ok(log.some((l) => /Cursor: .*não é um JSON válido/.test(l)), log.join('\n'));
  assert.ok(log.some((l) => /Copilot.*não foi criado pelo Scaffold Dev/.test(l)), log.join('\n'));
  assert.strictEqual(ler('.cursor', 'hooks.json'), '{ isso não é json');
  assert.strictEqual(ler('.copilot', 'hooks', 'scaffold-dev.json'), '{"meu":"arquivo"}');
});

test('o comando gravado na config realmente registra a mudança', () => {
  main(['codex']);
  const cmd = lerJson('.codex', 'hooks.json').hooks.PostToolUse[0].hooks[0].command;
  assert.ok(cmd.includes(MARCA));
  const payload = JSON.stringify({ tool_name: 'apply_patch', tool_input: { command: '*** Update File: src/x.js' }, session_id: 'cx' });
  const res = spawnSync(cmd, { shell: true, input: payload, env: process.env });
  assert.strictEqual(res.status, 0, res.stderr && res.stderr.toString());
  assert.strictEqual(store.lerLinhas('mudancas.jsonl')[0].alvo, 'src/x.js');
});

test('plugin do OpenCode gerado roda e mostra o lembrete', async () => {
  main(['opencode']);
  const fonte = ler('.config', 'opencode', 'plugins', 'scaffold-dev.js');
  const mjs = path.join(casa, 'opencode-plugin.mjs');
  fs.writeFileSync(mjs, fonte);
  const { ScaffoldDev } = await import(pathToFileURL(mjs).href);

  const toasts = [];
  const client = { tui: { showToast: async (o) => toasts.push(o.body.message) } };
  const hooks = await ScaffoldDev({ client, directory: process.cwd() });
  await hooks['tool.execute.after']({ tool: 'edit', sessionID: 'oc', args: { filePath: '/p/z.ts' } });
  assert.strictEqual(store.lerLinhas('mudancas.jsonl')[0].alvo, '/p/z.ts');

  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'oc' } } });
  assert.strictEqual(toasts.length, 1);
  assert.match(toasts[0], /Scaffold Dev — .*scaffold-dev-/);
});

test('plugin do Amp gerado roda (Node com suporte a TypeScript)', { skip: !process.features?.typescript }, async () => {
  main(['amp']);
  const mts = path.join(casa, 'amp-plugin.mts');
  fs.writeFileSync(mts, ler('.config', 'amp', 'plugins', 'scaffold-dev.ts'));
  const plugin = (await import(pathToFileURL(mts).href)).default;

  const handlers = {};
  const notificacoes = [];
  plugin({
    on: (ev, fn) => (handlers[ev] = fn),
    helpers: {
      filesModifiedByToolCall: () => ['file:///p/amp.js'],
      filePathFromURI: (u) => u.replace('file://', ''),
      shellCommandFromToolCall: () => ({ command: 'npm test', dir: '/p' }),
    },
  });
  await handlers['tool.result']({ thread: { id: 'amp1' } });
  assert.strictEqual(store.lerLinhas('mudancas.jsonl')[0].alvo, '/p/amp.js');
  assert.strictEqual(store.lerLinhas('comandos.jsonl')[0].comando, 'npm test');

  await handlers['agent.end']({ thread: { id: 'amp1' } }, { ui: { notify: async (m) => notificacoes.push(m) } });
  assert.strictEqual(notificacoes.length, 1);
});
