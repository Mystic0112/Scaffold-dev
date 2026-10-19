'use strict';

// Cálculo puro de métricas de estudo a partir do perfil, diário e trilha.

const MS_POR_DIA = 86400000;
const TIPOS = ['previsao', 'revisao', 'explicacao'];

const AREAS_PADRAO = [
  { id: 'codigo-limpo', nome: 'Código limpo e design' },
  { id: 'testes', nome: 'Testes' },
  { id: 'debugging', nome: 'Debugging e investigação' },
  { id: 'banco-de-dados', nome: 'Banco de dados e SQL' },
  { id: 'apis-http', nome: 'APIs e HTTP' },
  { id: 'seguranca', nome: 'Segurança' },
  { id: 'arquitetura', nome: 'Arquitetura' },
  { id: 'performance', nome: 'Performance' },
  { id: 'assincrono', nome: 'Concorrência e assíncrono' },
  { id: 'producao', nome: 'Produção e observabilidade' },
  { id: 'colaboracao', nome: 'Git e colaboração' },
];

function extrairAreasTrilha(trilha) {
  if (Array.isArray(trilha)) return trilha;
  if (trilha && Array.isArray(trilha.areas)) return trilha.areas;
  return AREAS_PADRAO;
}

function entradaValida(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.ts !== 'string' && typeof item.ts !== 'number' && !(item.ts instanceof Date)) return false;
  if (item.ts === '') return false;
  const tempo = new Date(item.ts).getTime();
  if (!Number.isFinite(tempo)) return false;
  if (typeof item.nota !== 'number' || !Number.isFinite(item.nota) || item.nota < 0 || item.nota > 10) return false;
  return true;
}

// Converte Date para número inteiro de dias civis no fuso local da máquina.
function diaLocal(data) {
  return Math.round(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / MS_POR_DIA);
}

function formatarDia(numDia) {
  return new Date(numDia * MS_POR_DIA).toISOString().slice(0, 10);
}

// Calcula a semana ISO ("AAAA-Www") para um dia civil local.
function semanaIso(numDia) {
  const d = new Date(numDia * MS_POR_DIA);
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const anoIso = d.getUTCFullYear();
  const inicioAno = Date.UTC(anoIso, 0, 1);
  const numSemana = Math.ceil(((d.getTime() - inicioAno) / MS_POR_DIA + 1) / 7);
  return `${anoIso}-W${String(numSemana).padStart(2, '0')}`;
}

function calcularSequencias(diasAtivosSet, hoje) {
  const dias = [...diasAtivosSet].sort((a, b) => a - b);
  let melhorSequencia = 0;
  let atual = 0;
  for (let i = 0; i < dias.length; i++) {
    atual = i === 0 || dias[i] === dias[i - 1] + 1 ? atual + 1 : 1;
    if (atual > melhorSequencia) melhorSequencia = atual;
  }

  let sequenciaAtual = 0;
  let cursor = diasAtivosSet.has(hoje) ? hoje : diasAtivosSet.has(hoje - 1) ? hoje - 1 : null;
  while (cursor !== null && diasAtivosSet.has(cursor)) {
    sequenciaAtual += 1;
    cursor -= 1;
  }

  return { sequenciaAtual, melhorSequencia };
}

function sugerirProximoPasso(areas) {
  const praticadas = areas.filter((a) => a.total >= 2 && a.media !== null);
  if (praticadas.length > 0) {
    const menor = praticadas.reduce((acc, a) => (a.media < acc.media ? a : acc), praticadas[0]);
    return `Praticar ${menor.nome} (média ${menor.media.toFixed(1)}/10)`;
  }
  const inedita = areas.find((a) => a.total === 0);
  if (inedita) {
    return `Começar por ${inedita.nome} (ainda sem prática)`;
  }
  return 'Continue praticando para consolidar a trilha.';
}

function calcularMetricas({ perfil = {}, diario = [], trilha, agora = new Date() } = {}) {
  const ref = new Date(agora);
  const dataRef = Number.isFinite(ref.getTime()) ? ref : new Date();
  const agoraMs = dataRef.getTime();
  const limite7DiasMs = agoraMs - 7 * MS_POR_DIA;
  const hoje = diaLocal(dataRef);

  const listaDiario = Array.isArray(diario) ? diario : [];
  const validas = [];

  for (let i = 0; i < listaDiario.length; i++) {
    const item = listaDiario[i];
    if (!entradaValida(item)) continue;
    const data = new Date(item.ts);
    validas.push({ item, tempo: data.getTime(), numDia: diaLocal(data), idx: i });
  }

  const acumTipos = {
    previsao: { total: 0, soma: 0 },
    revisao: { total: 0, soma: 0 },
    explicacao: { total: 0, soma: 0 },
  };

  const areasTrilha = extrairAreasTrilha(trilha);
  const acumAreas = new Map();
  for (const a of areasTrilha) {
    if (a && a.id) acumAreas.set(a.id, { id: a.id, nome: a.nome || a.id, total: 0, soma: 0 });
  }

  const semanasMapa = new Map();
  for (let i = 11; i >= 0; i--) {
    const ch = semanaIso(hoje - i * 7);
    if (!semanasMapa.has(ch)) semanasMapa.set(ch, { semana: ch, total: 0, soma: 0 });
  }

  const calendarioMapa = new Map();
  for (let i = 181; i >= 0; i--) {
    const d = formatarDia(hoje - i);
    calendarioMapa.set(d, 0);
  }

  const contagemConceitos = new Map();
  const diasAtivos = new Set();
  let somaGeral = 0;
  let ultimos7Dias = 0;

  for (const { item, tempo, numDia } of validas) {
    somaGeral += item.nota;
    if (tempo >= limite7DiasMs && tempo <= agoraMs) ultimos7Dias += 1;
    diasAtivos.add(numDia);

    if (TIPOS.includes(item.tipo)) {
      acumTipos[item.tipo].total += 1;
      acumTipos[item.tipo].soma += item.nota;
    }

    if (Array.isArray(item.areas)) {
      for (const areaId of item.areas) {
        const reg = acumAreas.get(areaId);
        if (reg) {
          reg.total += 1;
          reg.soma += item.nota;
        }
      }
    }

    const chSemana = semanaIso(numDia);
    const sem = semanasMapa.get(chSemana);
    if (sem) {
      sem.total += 1;
      sem.soma += item.nota;
    }

    const chDia = formatarDia(numDia);
    if (calendarioMapa.has(chDia)) {
      calendarioMapa.set(chDia, calendarioMapa.get(chDia) + 1);
    }

    if (Array.isArray(item.conceitos)) {
      for (const c of item.conceitos) {
        const nome = typeof c === 'string' ? c.trim() : '';
        if (nome) contagemConceitos.set(nome, (contagemConceitos.get(nome) || 0) + 1);
      }
    }
  }

  const totalAtividades = validas.length;
  const mediaGeral = totalAtividades > 0 ? somaGeral / totalAtividades : null;
  const { sequenciaAtual, melhorSequencia } = calcularSequencias(diasAtivos, hoje);

  const porTipo = {};
  for (const t of TIPOS) {
    const { total, soma } = acumTipos[t];
    porTipo[t] = { total, media: total > 0 ? soma / total : null };
  }

  const areas = [...acumAreas.values()].map(({ id, nome, total, soma }) => ({
    id,
    nome,
    total,
    media: total > 0 ? soma / total : null,
  }));

  const evolucaoSemanal = [...semanasMapa.values()].map(({ semana, total, soma }) => ({
    semana,
    total,
    media: total > 0 ? soma / total : null,
  }));

  const calendario = [...calendarioMapa.entries()].map(([data, total]) => ({ data, total }));

  const conceitos = [...contagemConceitos.entries()]
    .map(([nome, vezes]) => ({ nome, vezes }))
    .sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome))
    .slice(0, 15);

  const lacunas = areas.filter((a) => a.total === 0 || (a.total >= 2 && a.media < 6));
  const proximoPasso = sugerirProximoPasso(areas);

  const atividadesRecentes = validas
    .slice()
    .sort((a, b) => b.tempo - a.tempo || b.idx - a.idx)
    .slice(0, 50)
    .map((v) => v.item);

  return {
    perfil: {
      nivel: perfil?.nivel || 'junior',
      stack: perfil?.stack || '',
      idioma: perfil?.idioma || 'pt-BR',
    },
    resumo: {
      totalAtividades,
      mediaGeral,
      ultimos7Dias,
      sequenciaAtual,
      melhorSequencia,
    },
    porTipo,
    areas,
    evolucaoSemanal,
    calendario,
    conceitos,
    lacunas,
    proximoPasso,
    atividadesRecentes,
  };
}

module.exports = {
  calcularMetricas,
};
