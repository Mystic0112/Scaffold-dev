'use strict';

const test = require('node:test');
const assert = require('node:assert');
const trilhaPadrao = require('../data/pt-BR/trilha.json');
const { calcularMetricas } = require('../scripts/lib/metricas');

function dataLocalIso(ano, mes, dia, hora = 12, min = 0) {
  return new Date(ano, mes - 1, dia, hora, min, 0).toISOString();
}

test('diário vazio retorna métricas zeradas, médias nulas e 11 áreas na trilha', () => {
  const agora = new Date(2026, 9, 19, 15, 0, 0);
  const m = calcularMetricas({
    perfil: { nivel: 'junior', stack: 'Node.js', idioma: 'pt-BR' },
    diario: [],
    trilha: trilhaPadrao,
    agora,
  });

  assert.deepStrictEqual(m.perfil, { nivel: 'junior', stack: 'Node.js', idioma: 'pt-BR' });
  assert.deepStrictEqual(m.resumo, {
    totalAtividades: 0,
    mediaGeral: null,
    ultimos7Dias: 0,
    sequenciaAtual: 0,
    melhorSequencia: 0,
  });
  assert.deepStrictEqual(m.porTipo, {
    previsao: { total: 0, media: null },
    revisao: { total: 0, media: null },
    explicacao: { total: 0, media: null },
  });
  assert.strictEqual(m.areas.length, 11);
  assert.ok(m.areas.every((a) => a.total === 0 && a.media === null));
  assert.strictEqual(m.evolucaoSemanal.length, 12);
  assert.ok(m.evolucaoSemanal.every((s) => s.total === 0 && s.media === null));
  assert.strictEqual(m.calendario.length, 182);
  assert.ok(m.calendario.every((c) => c.total === 0));
  assert.deepStrictEqual(m.conceitos, []);
  assert.strictEqual(m.lacunas.length, 11);
  assert.strictEqual(m.proximoPasso, 'Começar por Código limpo e design (ainda sem prática)');
  assert.deepStrictEqual(m.atividadesRecentes, []);
});

test('sequência atual e melhor sequência com buraco no meio, terminando hoje, ontem e quebrada', () => {
  const agora = new Date(2026, 9, 19, 18, 0, 0); // 19/10/2026 local

  // Sequência antiga de 4 dias (01/10 a 04/10), buraco, e sequência atual de 2 dias (18/10 e 19/10)
  const diarioHoje = [
    { ts: dataLocalIso(2026, 10, 1), tipo: 'previsao', nota: 7 },
    { ts: dataLocalIso(2026, 10, 2), tipo: 'revisao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 3), tipo: 'explicacao', nota: 9 },
    { ts: dataLocalIso(2026, 10, 4), tipo: 'revisao', nota: 6 },
    { ts: dataLocalIso(2026, 10, 18), tipo: 'previsao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 19, 9), tipo: 'revisao', nota: 7 },
    { ts: dataLocalIso(2026, 10, 19, 14), tipo: 'explicacao', nota: 9 }, // mesmo dia
  ];
  const mHoje = calcularMetricas({ diario: diarioHoje, trilha: trilhaPadrao, agora });
  assert.strictEqual(mHoje.resumo.sequenciaAtual, 2);
  assert.strictEqual(mHoje.resumo.melhorSequencia, 4);

  // Terminando ontem (16/10, 17/10, 18/10)
  const diarioOntem = [
    { ts: dataLocalIso(2026, 10, 16), tipo: 'previsao', nota: 7 },
    { ts: dataLocalIso(2026, 10, 17), tipo: 'revisao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 18), tipo: 'explicacao', nota: 9 },
  ];
  const mOntem = calcularMetricas({ diario: diarioOntem, trilha: trilhaPadrao, agora });
  assert.strictEqual(mOntem.resumo.sequenciaAtual, 3);
  assert.strictEqual(mOntem.resumo.melhorSequencia, 3);

  // Quebrada há 2+ dias (última em 17/10)
  const diarioQuebrada = [
    { ts: dataLocalIso(2026, 10, 15), tipo: 'previsao', nota: 7 },
    { ts: dataLocalIso(2026, 10, 16), tipo: 'revisao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 17), tipo: 'explicacao', nota: 9 },
  ];
  const mQuebrada = calcularMetricas({ diario: diarioQuebrada, trilha: trilhaPadrao, agora });
  assert.strictEqual(mQuebrada.resumo.sequenciaAtual, 0);
  assert.strictEqual(mQuebrada.resumo.melhorSequencia, 3);
});

test('semanas vazias preenchidas nas 12 semanas ISO e calendário de 182 dias', () => {
  const agora = new Date(2026, 9, 19, 12, 0, 0); // 2026-10-19 (segunda-feira, 2026-W43)
  const diario = [
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 19, 10), tipo: 'previsao', nota: 6 },
    { ts: dataLocalIso(2026, 10, 5), tipo: 'explicacao', nota: 10 }, // 2 semanas antes (2026-W41)
  ];

  const m = calcularMetricas({ diario, trilha: trilhaPadrao, agora });
  assert.strictEqual(m.evolucaoSemanal.length, 12);

  const ultimaSemana = m.evolucaoSemanal[11];
  assert.strictEqual(ultimaSemana.semana, '2026-W43');
  assert.strictEqual(ultimaSemana.total, 2);
  assert.strictEqual(ultimaSemana.media, 7);

  const penultimaSemana = m.evolucaoSemanal[10];
  assert.strictEqual(penultimaSemana.semana, '2026-W42');
  assert.strictEqual(penultimaSemana.total, 0);
  assert.strictEqual(penultimaSemana.media, null);

  const antepenultimaSemana = m.evolucaoSemanal[9];
  assert.strictEqual(antepenultimaSemana.semana, '2026-W41');
  assert.strictEqual(antepenultimaSemana.total, 1);
  assert.strictEqual(antepenultimaSemana.media, 10);

  assert.strictEqual(m.calendario.length, 182);
  assert.strictEqual(m.calendario[181].data, '2026-10-19');
  assert.strictEqual(m.calendario[181].total, 2);
  assert.strictEqual(m.calendario[180].data, '2026-10-18');
  assert.strictEqual(m.calendario[180].total, 0);
});

test('área nunca praticada tem media null e entra em lacunas junto com área total >= 2 e media < 6', () => {
  const agora = new Date(2026, 9, 19, 12, 0, 0);
  const diario = [
    { ts: dataLocalIso(2026, 10, 18), tipo: 'revisao', nota: 4, areas: ['seguranca'] },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 5, areas: ['seguranca'] },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'previsao', nota: 9, areas: ['testes'] },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'explicacao', nota: 8, areas: ['testes'] },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 3, areas: ['debugging'] }, // apenas 1 registro < 6
  ];

  const m = calcularMetricas({ diario, trilha: trilhaPadrao, agora });

  const areaCodigoLimpo = m.areas.find((a) => a.id === 'codigo-limpo');
  assert.strictEqual(areaCodigoLimpo.total, 0);
  assert.strictEqual(areaCodigoLimpo.media, null);

  const areaSeguranca = m.areas.find((a) => a.id === 'seguranca');
  assert.strictEqual(areaSeguranca.total, 2);
  assert.strictEqual(areaSeguranca.media, 4.5);

  const areaTestes = m.areas.find((a) => a.id === 'testes');
  assert.strictEqual(areaTestes.total, 2);
  assert.strictEqual(areaTestes.media, 8.5);

  const idsLacunas = m.lacunas.map((l) => l.id);
  assert.ok(idsLacunas.includes('codigo-limpo'), 'área nunca praticada entra em lacunas');
  assert.ok(idsLacunas.includes('seguranca'), 'área com total >= 2 e media < 6 entra em lacunas');
  assert.ok(!idsLacunas.includes('testes'), 'área com media >= 6 não entra em lacunas');
  assert.ok(!idsLacunas.includes('debugging'), 'área com total === 1 não entra em lacunas');
});

test('entradas inválidas são ignoradas', () => {
  const agora = new Date(2026, 9, 19, 12, 0, 0);
  const diario = [
    null,
    'invalido',
    { ts: 'nao-e-data', tipo: 'revisao', nota: 8 },
    { ts: '', tipo: 'revisao', nota: 8 },
    { ts: null, tipo: 'revisao', nota: 8 },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: -1 },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 10.5 },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: '8' },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: NaN },
    { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 8, conceitos: ['XSS'] },
  ];

  const m = calcularMetricas({ diario, trilha: trilhaPadrao, agora });
  assert.strictEqual(m.resumo.totalAtividades, 1);
  assert.strictEqual(m.resumo.mediaGeral, 8);
  assert.strictEqual(m.atividadesRecentes.length, 1);
  assert.deepStrictEqual(m.conceitos, [{ nome: 'XSS', vezes: 1 }]);
});

test('proximoPasso cobre os 3 casos da regra', () => {
  const agora = new Date(2026, 9, 19, 12, 0, 0);
  const trilhaCurta = [
    { id: 'testes', nome: 'Testes' },
    { id: 'seguranca', nome: 'Segurança' },
  ];

  // Caso 1: área com menor média entre as que têm total >= 2
  const m1 = calcularMetricas({
    diario: [
      { ts: dataLocalIso(2026, 10, 18), tipo: 'revisao', nota: 8, areas: ['testes'] },
      { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 9, areas: ['testes'] },
      { ts: dataLocalIso(2026, 10, 18), tipo: 'revisao', nota: 5, areas: ['seguranca'] },
      { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 6, areas: ['seguranca'] },
    ],
    trilha: trilhaCurta,
    agora,
  });
  assert.strictEqual(m1.proximoPasso, 'Praticar Segurança (média 5.5/10)');

  // Caso 2: nenhuma área com total >= 2, escolhe a primeira área com total === 0
  const m2 = calcularMetricas({
    diario: [
      { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 8, areas: ['testes'] },
    ],
    trilha: trilhaCurta,
    agora,
  });
  assert.strictEqual(m2.proximoPasso, 'Começar por Segurança (ainda sem prática)');

  // Caso 3: nenhuma área com total >= 2 e nenhuma com total === 0 (todas com total === 1)
  const m3 = calcularMetricas({
    diario: [
      { ts: dataLocalIso(2026, 10, 18), tipo: 'revisao', nota: 8, areas: ['testes'] },
      { ts: dataLocalIso(2026, 10, 19), tipo: 'revisao', nota: 7, areas: ['seguranca'] },
    ],
    trilha: trilhaCurta,
    agora,
  });
  assert.strictEqual(m3.proximoPasso, 'Continue praticando para consolidar a trilha.');
});
