'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { portarSkill, separarFrontmatter } = require('../scripts/lib/portar');

const SKILLS = path.join(__dirname, '..', 'skills');
const opts = { raiz: 'C:\\x\\scaffold dev', invocar: (n) => `$${n}` };

test('todo skill do repo é portável e fica sem nada exclusivo do Claude Code', () => {
  const nomes = fs.readdirSync(SKILLS);
  assert.ok(nomes.length >= 6);
  for (const dir of nomes) {
    const original = fs.readFileSync(path.join(SKILLS, dir, 'SKILL.md'), 'utf8');
    assert.strictEqual(separarFrontmatter(original).campos.name, dir, `name deve ser igual à pasta em ${dir}`);

    const { nome, texto } = portarSkill(original, opts);
    assert.strictEqual(nome, `scaffold-dev-${dir}`);
    const { campos, corpo } = separarFrontmatter(texto);
    assert.deepStrictEqual(Object.keys(campos), ['name', 'description']);
    assert.ok(JSON.parse(campos.description).length > 20);
    for (const proibido of ['${CLAUDE_PLUGIN_ROOT}', '$ARGUMENTS', '/scaffold-dev:', '!`']) {
      assert.ok(!corpo.includes(proibido), `${dir} ainda contém ${proibido}`);
    }
  }
});

test('portarSkill troca caminho, invocação e argumentos', () => {
  const original = [
    '---',
    'name: revisar',
    'description: Treino de review',
    'disable-model-invocation: true',
    '---',
    'Escopo: $ARGUMENTS',
    'rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" contexto revisar`',
    'depois use /scaffold-dev:explicar',
  ].join('\n');
  const { texto } = portarSkill(original, opts);
  assert.match(texto, /node "C:\/x\/scaffold dev\/scripts\/cli\.js" contexto revisar/);
  assert.match(texto, /use \$scaffold-dev-explicar/);
  assert.match(texto, /Escopo: \(o que o usuário escreveu/);
  assert.doesNotMatch(texto, /disable-model-invocation/);
});
