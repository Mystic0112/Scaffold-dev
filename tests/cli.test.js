'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');
const { main } = require('../scripts/cli');

test.beforeEach(() => dirTemporario());

test('registrar atualiza estatísticas, áreas, conceitos e diário', () => {
  const r = main(['registrar', '--tipo', 'revisao', '--nota', '7', '--areas', 'testes,seguranca,inexistente', '--conceitos', 'N+1, XSS', '--resumo', 'revisou CRUD']);
  assert.strictEqual(r.codigo, 0, r.saida);
  const p = store.lerPerfil();
  assert.deepStrictEqual(p.estatisticas.revisao, { total: 1, somaNotas: 7 });
  assert.deepStrictEqual(Object.keys(p.areas).sort(), ['seguranca', 'testes']);
  assert.strictEqual(p.conceitos['XSS'], 1);
  assert.match(main(['diario']).saida, /revisao 7\/10 — revisou CRUD/);
});

test('registrar valida tipo e nota', () => {
  assert.strictEqual(main(['registrar', '--tipo', 'xyz', '--nota', '5']).codigo, 1);
  assert.strictEqual(main(['registrar', '--tipo', 'previsao', '--nota', '11']).codigo, 1);
  assert.strictEqual(main(['registrar', '--tipo', 'previsao']).codigo, 1);
});

test('config muda nível, stack e lembretes', () => {
  assert.strictEqual(main(['config', 'nivel', 'estagiario']).codigo, 0);
  assert.strictEqual(main(['config', 'nivel', 'senior']).codigo, 1);
  main(['config', 'stack', 'Laravel', '+', 'Vue']);
  main(['config', 'lembretes', 'off']);
  const p = store.lerPerfil();
  assert.strictEqual(p.nivel, 'estagiario');
  assert.strictEqual(p.stack, 'Laravel + Vue');
  assert.strictEqual(p.lembretes, false);
});

test('mudancas filtra pelo projeto atual e remove duplicados', () => {
  const ts = new Date().toISOString();
  store.anexarLinha('mudancas.jsonl', { ts, cwd: process.cwd(), tipo: 'edicao', alvo: 'a.js' });
  store.anexarLinha('mudancas.jsonl', { ts, cwd: process.cwd(), tipo: 'edicao', alvo: 'a.js' });
  store.anexarLinha('mudancas.jsonl', { ts, cwd: '/outro/projeto', tipo: 'edicao', alvo: 'b.js' });
  const saida = main(['mudancas']).saida;
  assert.strictEqual(saida.split('a.js').length - 1, 1);
  assert.ok(!saida.includes('b.js'));
  assert.ok(main(['mudancas', '--todas']).saida.includes('b.js'));
});

test('mudancas reconhece cwd no formato do Git Bash no Windows', { skip: process.platform !== 'win32' }, () => {
  const msys = process.cwd().replace(/^([A-Za-z]):\\/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/');
  store.anexarLinha('mudancas.jsonl', { ts: new Date().toISOString(), cwd: msys, tipo: 'edicao', alvo: 'c.js' });
  assert.ok(main(['mudancas']).saida.includes('c.js'));
});

test('trilha mostra todas as áreas e o radar', () => {
  main(['registrar', '--tipo', 'previsao', '--nota', '8', '--areas', 'testes']);
  const saida = main(['trilha']).saida;
  assert.match(saida, /Testes\s+████████░░  8\.0/);
  assert.match(saida, /Segurança/);
});

test('comando desconhecido retorna erro', () => {
  assert.strictEqual(main(['voar']).codigo, 1);
});
