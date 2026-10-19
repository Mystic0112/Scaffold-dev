#!/usr/bin/env node
'use strict';

// Gera ~60 atividades de exemplo distribuídas nos últimos 3 meses (~90 dias)
// em um diretório SCAFFOLD_DEV_HOME isolado para validação manual e testes do painel.

const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../lib/store');

const MS_POR_DIA = 86400000;

const ATIVIDADES_MODELO = [
  {
    tipo: 'revisao',
    areas: ['seguranca', 'apis-http'],
    conceitos: ['XSS', 'Validação de entrada'],
    notaBase: 5,
    resumo: 'Revisei validação e escape de parâmetros no endpoint de comentários',
    projeto: 'api-pedidos',
  },
  {
    tipo: 'previsao',
    areas: ['banco-de-dados', 'performance'],
    conceitos: ['Problema N+1', 'Índices', 'Lazy vs eager loading'],
    notaBase: 7,
    resumo: 'Previ a criação de índice composto e eager loading na listagem de faturas',
    projeto: 'api-pedidos',
  },
  {
    tipo: 'explicacao',
    areas: ['testes', 'codigo-limpo'],
    conceitos: ['Pirâmide de testes', 'Casos de borda', 'Injeção de dependência'],
    notaBase: 8,
    resumo: 'Expliquei como isolar o serviço de pagamento usando fakes em vez de mocks frágeis',
    projeto: 'checkout-web',
  },
  {
    tipo: 'revisao',
    areas: ['debugging', 'producao'],
    conceitos: ['Causa raiz vs sintoma', 'Logs estruturados'],
    notaBase: 7,
    resumo: 'Identifiquei falta de correlationId nos logs de erro do worker de conciliação',
    projeto: 'worker-pagamentos',
  },
  {
    tipo: 'previsao',
    areas: ['arquitetura', 'apis-http'],
    conceitos: ['Idempotência', 'Camadas e separação de responsabilidades'],
    notaBase: 8,
    resumo: 'Planejei chave de idempotência para evitar cobrança duplicada no webhook',
    projeto: 'worker-pagamentos',
  },
  {
    tipo: 'revisao',
    areas: ['seguranca'],
    conceitos: ['SQL injection', 'Controle de acesso quebrado'],
    notaBase: 4,
    resumo: 'Deixei passar checagem de tenant_id na query de exportação de relatórios',
    projeto: 'painel-admin',
  },
  {
    tipo: 'explicacao',
    areas: ['codigo-limpo', 'colaboracao'],
    conceitos: ['Responsabilidade única', 'Commits atômicos'],
    notaBase: 9,
    resumo: 'Expliquei a extração do validador de CPF/CNPJ e separação do PR de refatoração',
    projeto: 'checkout-web',
  },
  {
    tipo: 'previsao',
    areas: ['banco-de-dados'],
    conceitos: ['Transações e isolamento', 'Migrações sem downtime'],
    notaBase: 7,
    resumo: 'Planejei migração em duas etapas para adicionar coluna não nula sem lock longo',
    projeto: 'api-pedidos',
  },
  {
    tipo: 'revisao',
    areas: ['testes', 'apis-http'],
    conceitos: ['Verbos e status HTTP', 'Testes de integração com banco'],
    notaBase: 8,
    resumo: 'Revisei testes de contrato e retorno 422 vs 409 no cadastro de clientes',
    projeto: 'api-pedidos',
  },
  {
    tipo: 'explicacao',
    areas: ['performance', 'arquitetura'],
    conceitos: ['Cache e invalidação', 'Trade-offs'],
    notaBase: 7,
    resumo: 'Expliquei por que usar TTL curto no catálogo em vez de invalidação manual complexa',
    projeto: 'painel-admin',
  },
];

function gerarDadosExemplo({ home, total = 60, agora = new Date() } = {}) {
  if (home) {
    process.env.SCAFFOLD_DEV_HOME = home;
  } else if (!process.env.SCAFFOLD_DEV_HOME) {
    process.env.SCAFFOLD_DEV_HOME = path.join(os.tmpdir(), 'scaffold-dev-exemplo');
  }

  const dir = store.dataDir();
  for (const arq of ['perfil.json', 'diario.jsonl', 'mudancas.jsonl', 'comandos.jsonl']) {
    const caminho = path.join(dir, arq);
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
  }

  const perfil = store.lerPerfil();
  perfil.nivel = 'junior';
  perfil.stack = 'Node.js + PostgreSQL';
  perfil.idioma = 'pt-BR';

  const baseMs = new Date(agora).getTime();
  const entradas = [];

  for (let i = 0; i < total; i++) {
    const modelo = ATIVIDADES_MODELO[i % ATIVIDADES_MODELO.length];
    // Distribui ao longo de ~90 dias, mais concentrado nas últimas semanas
    const diasAtras = i < 6 ? i : Math.floor(((total - 1 - i) / total) * 88);
    const ts = new Date(baseMs - diasAtras * MS_POR_DIA - (i % 5) * 3600000).toISOString();

    // Mantém 'seguranca' com notas entre 4 e 5 (média < 6) e 'assincrono' sem prática (lacunas)
    let nota = modelo.notaBase;
    if (modelo.areas.includes('seguranca')) {
      nota = i % 2 === 0 ? 4 : 5;
    } else {
      nota = Math.min(10, Math.max(4, modelo.notaBase + ((i % 3) - 1)));
    }

    entradas.push({
      ts,
      projeto: modelo.projeto,
      tipo: modelo.tipo,
      nota,
      areas: modelo.areas,
      conceitos: modelo.conceitos,
      resumo: `${modelo.resumo} (#${i + 1})`,
    });
  }

  // Ordena cronologicamente do mais antigo para o mais recente
  entradas.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  for (const e of entradas) {
    perfil.estatisticas[e.tipo].total += 1;
    perfil.estatisticas[e.tipo].somaNotas += e.nota;
    for (const a of e.areas) {
      perfil.areas[a] = perfil.areas[a] || { total: 0, somaNotas: 0 };
      perfil.areas[a].total += 1;
      perfil.areas[a].somaNotas += e.nota;
    }
    for (const c of e.conceitos) {
      perfil.conceitos[c] = (perfil.conceitos[c] || 0) + 1;
    }
    store.anexarLinha('diario.jsonl', e);
  }

  store.gravarPerfil(perfil);
  return { dir, total: entradas.length };
}

if (require.main === module) {
  const { dir, total } = gerarDadosExemplo();
  process.stdout.write(`Dados de exemplo gerados (${total} atividades) em: ${dir}\n`);
}

module.exports = { gerarDadosExemplo };
