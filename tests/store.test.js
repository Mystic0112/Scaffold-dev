'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');

test.beforeEach(() => dirTemporario());

test('redigir esconde segredos comuns', () => {
  const casos = [
    ['curl -H "Authorization: Bearer abc.def.ghi123"', 'abc.def.ghi123'],
    ['export API_KEY=supersecreto123', 'supersecreto123'],
    ['mysql --password=hunter22 -u root', 'hunter22'],
    ['git clone https://user:minhasenha@github.com/x/y', 'minhasenha'],
    ['echo ghp_abcdefghijklmnopqrstuvwxyz0123', 'ghp_abcdefghijklmnopqrstuvwxyz0123'],
    ['key sk-ant-api03-AAAAAAAAAAAAAAAA', 'sk-ant-api03-AAAAAAAAAAAAAAAA'],
    ['aws AKIAABCDEFGHIJKLMNOP', 'AKIAABCDEFGHIJKLMNOP'],
    ['senha: "minha senha"', 'minha senha'],
  ];
  for (const [entrada, segredo] of casos) {
    const saida = store.redigir(entrada);
    assert.ok(!saida.includes(segredo), `vazou "${segredo}" em: ${saida}`);
    assert.ok(saida.includes('***'), `não marcou redação em: ${saida}`);
  }
});

test('redigir mantém comandos comuns intactos e trunca longos', () => {
  assert.strictEqual(store.redigir('npm test -- --watch'), 'npm test -- --watch');
  const longo = store.redigir('x'.repeat(500), 50);
  assert.strictEqual(longo.length, 51);
  assert.ok(longo.endsWith('…'));
});

test('anexarLinha rotaciona mantendo as últimas linhas', () => {
  for (let i = 0; i < 15; i++) store.anexarLinha('t.jsonl', { i }, 10);
  const linhas = store.lerLinhas('t.jsonl');
  assert.strictEqual(linhas.length, 10);
  assert.strictEqual(linhas[0].i, 5);
  assert.strictEqual(linhas[9].i, 14);
});

test('perfil novo tem padrões e persiste alterações', () => {
  const p = store.lerPerfil();
  assert.strictEqual(p.nivel, 'junior');
  assert.ok(p.criadoEm);
  p.nivel = 'pleno';
  store.gravarPerfil(p);
  assert.strictEqual(store.lerPerfil().nivel, 'pleno');
});

test('migra dados da v0.1.0 ($CLAUDE_PLUGIN_DATA) para ~/.scaffold-dev uma única vez', () => {
  const fs = require('fs');
  const path = require('path');
  const raiz = path.dirname(process.env.SCAFFOLD_DEV_HOME);
  const antigo = path.join(raiz, 'plugin-data');
  const casa = path.join(raiz, 'casa');
  fs.mkdirSync(antigo);
  fs.writeFileSync(path.join(antigo, 'perfil.json'), JSON.stringify({ nivel: 'pleno' }));
  fs.writeFileSync(path.join(antigo, 'diario.jsonl'), '{"tipo":"revisao","nota":7}\n');

  const env = { ...process.env };
  try {
    delete process.env.SCAFFOLD_DEV_HOME;
    process.env.CLAUDE_PLUGIN_DATA = antigo;
    process.env.HOME = casa;
    process.env.USERPROFILE = casa;
    assert.strictEqual(store.dataDir(), path.join(casa, '.scaffold-dev'));
    assert.strictEqual(store.lerPerfil().nivel, 'pleno');
    assert.strictEqual(store.lerLinhas('diario.jsonl').length, 1);

    fs.writeFileSync(path.join(antigo, 'perfil.json'), JSON.stringify({ nivel: 'estagiario' }));
    assert.strictEqual(store.lerPerfil().nivel, 'pleno', 'não sobrescreve depois da primeira vez');
  } finally {
    process.env = env;
  }
});
