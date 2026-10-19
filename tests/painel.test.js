'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { dirTemporario } = require('./helpers');
const store = require('../scripts/lib/store');
const trilhaPadrao = require('../data/pt-BR/trilha.json');
const { calcularMetricas } = require('../scripts/lib/metricas');
const { gerarHtml } = require('../scripts/lib/painel-html');
const { main, iniciarServidorPainel } = require('../scripts/cli');
const { gerarDadosExemplo } = require('../scripts/dev/dados-exemplo');

test.beforeEach(() => dirTemporario());

function dataLocalIso(ano, mes, dia, hora = 12, min = 0) {
  return new Date(ano, mes - 1, dia, hora, min, 0).toISOString();
}

function requisitarHttp(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const partes = [];
      res.on('data', (chunk) => partes.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          corpo: Buffer.concat(partes).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
  });
}

function extrairJsonDados(html) {
  const match = html.match(/<script type="application\/json" id="dados">([\s\S]*?)<\/script>/);
  assert.ok(match, 'HTML deve conter <script type="application/json" id="dados">');
  return JSON.parse(match[1]);
}

test('gerarHtml com dados de exemplo contém todas as 9 seções, números esperados e JSON em #dados', () => {
  const agora = new Date(2026, 9, 19, 15, 0, 0); // 19/10/2026 local
  const perfil = {
    nivel: 'junior',
    stack: 'Node.js + PostgreSQL',
    idioma: 'pt-BR',
  };
  const diario = [
    {
      ts: dataLocalIso(2026, 10, 18, 10),
      projeto: 'api-pedidos',
      tipo: 'previsao',
      nota: 8,
      areas: ['testes', 'codigo-limpo'],
      conceitos: ['Pirâmide de testes', 'Casos de borda'],
      resumo: 'Planejei testes unitários do serviço de pedidos',
    },
    {
      ts: dataLocalIso(2026, 10, 19, 11),
      projeto: 'api-pedidos',
      tipo: 'revisao',
      nota: 4,
      areas: ['seguranca'],
      conceitos: ['XSS', 'Validação de entrada'],
      resumo: 'Revisei sanitização no endpoint de comentários',
    },
    {
      ts: dataLocalIso(2026, 10, 19, 14),
      projeto: 'checkout-web',
      tipo: 'explicacao',
      nota: 5,
      areas: ['seguranca', 'testes'],
      conceitos: ['XSS'],
      resumo: 'Expliquei mitigação de XSS com Content-Security-Policy',
    },
  ];

  const metricas = calcularMetricas({ perfil, diario, trilha: trilhaPadrao, agora });
  const html = gerarHtml(metricas, { geradoEm: agora, modo: 'estatico', perfil });

  // 1. Cabeçalho com nível, stack e data de atualização
  assert.match(html, /id="secao-cabecalho"/);
  assert.match(html, /Scaffold Dev — Painel de estudo/);
  assert.match(html, /id="perfil-nivel">junior<\/strong>/);
  assert.match(html, /id="perfil-stack">Node\.js \+ PostgreSQL<\/strong>/);
  assert.match(html, /atualizado em 19\/10\/2026 15:00/);
  assert.match(html, /Modo estático/);

  // 2. Cartões (KPIs) com números esperados
  assert.match(html, /id="secao-kpis"/);
  assert.match(html, /id="kpi-total">3<\/strong>/);
  assert.match(html, /id="kpi-media">5\.7<\/strong>/);
  assert.match(html, /id="kpi-sequencia">🔥 2 dias<\/strong>/);
  assert.match(html, /id="kpi-ultimos7">3<\/strong>/);

  // 3. Radar da trilha (SVG + tabela acessível, eixos tracejados para sem dados)
  assert.match(html, /id="secao-radar"/);
  assert.match(html, /class="svg-radar"/);
  assert.match(html, /class="radar-eixo radar-eixo-ativo" data-area="testes" data-status="com-dados"/);
  assert.match(html, /class="radar-eixo radar-eixo-sem-dados" stroke-dasharray="4 4" data-area="banco-de-dados" data-status="sem-dados"/);
  assert.match(html, /id="tabela-radar"/);
  assert.match(html, /<td>Testes<\/td>\s*<td>6\.5<\/td>\s*<td>2<\/td>/);
  assert.match(html, /<td>Segurança<\/td>\s*<td>4\.5<\/td>\s*<td>2<\/td>/);
  assert.match(html, /<td>Banco de dados e SQL<\/td>\s*<td>—<\/td>\s*<td>0<\/td>/);

  // 4. Evolução semanal (SVG + tabela equivalente acessível)
  assert.match(html, /id="secao-evolucao"/);
  assert.match(html, /class="svg-evolucao"/);
  assert.match(html, /class="evolucao-barra"/);
  assert.match(html, /class="evolucao-ponto"/);
  assert.match(html, /id="tabela-evolucao"/);

  // 5. Calendário de atividade (heatmap de 182 dias com 5 tons e tooltip title)
  assert.match(html, /id="secao-calendario"/);
  assert.match(html, /class="svg-calendario"/);
  assert.match(html, /title="2 atividades em 19\/10"/);
  assert.match(html, /title="1 atividade em 18\/10"/);
  assert.match(html, /cal-nivel-0/);
  assert.match(html, /cal-nivel-1/);
  assert.match(html, /cal-nivel-2/);

  // 6. Por tipo (previsão, revisão, explicação)
  assert.match(html, /id="secao-tipos"/);
  assert.match(html, /data-tipo="previsao"[\s\S]*?Total: <strong>1<\/strong> · Média: <strong>8\.0<\/strong>/);
  assert.match(html, /data-tipo="revisao"[\s\S]*?Total: <strong>1<\/strong> · Média: <strong>4\.0<\/strong>/);
  assert.match(html, /data-tipo="explicacao"[\s\S]*?Total: <strong>1<\/strong> · Média: <strong>5\.0<\/strong>/);

  // 7. Conceitos mais estudados
  assert.match(html, /id="secao-conceitos"/);
  assert.match(html, /id="lista-conceitos"/);
  assert.match(html, /<span class="conceito-nome">XSS<\/span>\s*<span class="conceito-vezes">2x<\/span>/);
  assert.match(html, /<span class="conceito-nome">Pirâmide de testes<\/span>\s*<span class="conceito-vezes">1x<\/span>/);

  // 8. Lacunas e próximo passo
  assert.match(html, /id="secao-lacunas"/);
  assert.match(html, /id="texto-proximo-passo">Praticar Segurança \(média 4\.5\/10\)<\/p>/);
  assert.match(html, /id="lista-lacunas"/);
  assert.match(html, /Média baixa: 4\.5\/10 \(2 registros\)/);
  assert.match(html, /Ainda não praticada \(0 registros\)/);

  // 9. Diário com filtros (tipo, área, projeto, busca no resumo) e tabela
  assert.match(html, /id="secao-diario"/);
  assert.match(html, /id="filtro-tipo"/);
  assert.match(html, /id="filtro-area"/);
  assert.match(html, /id="filtro-projeto"/);
  assert.match(html, /id="filtro-busca"/);
  assert.match(html, /id="tabela-diario"/);
  assert.match(html, /Planejei testes unitários do serviço de pedidos/);
  assert.match(html, /Revisei sanitização no endpoint de comentários/);
  assert.match(html, /Expliquei mitigação de XSS com Content-Security-Policy/);

  // JSON embutido em <script type="application/json" id="dados">
  const dadosEmbutidos = extrairJsonDados(html);
  assert.strictEqual(dadosEmbutidos.resumo.totalAtividades, 3);
  assert.strictEqual(dadosEmbutidos.areas.length, 11);
  assert.strictEqual(dadosEmbutidos.evolucaoSemanal.length, 12);
  assert.strictEqual(dadosEmbutidos.calendario.length, 182);
  assert.strictEqual(dadosEmbutidos.proximoPasso, 'Praticar Segurança (média 4.5/10)');
});

test('estado vazio: com diário vazio mostra tela amigável explicando prever, revisar e explicar sem gráficos vazios', () => {
  const agora = new Date(2026, 9, 19, 15, 0, 0);
  const metricasVazias = calcularMetricas({
    perfil: { nivel: 'estagiario', stack: 'Python', idioma: 'pt-BR' },
    diario: [],
    trilha: trilhaPadrao,
    agora,
  });

  const html = gerarHtml(metricasVazias, { geradoEm: agora, modo: 'estatico' });
  const matchMain = html.match(/<main id="conteudo-principal">([\s\S]*?)<\/main>/);
  assert.ok(matchMain, 'HTML deve conter <main id="conteudo-principal">');
  const mainHtml = matchMain[1];

  assert.match(mainHtml, /id="estado-vazio"/);
  assert.match(mainHtml, /Comece sua jornada no Scaffold Dev/);
  assert.match(mainHtml, /<code>prever<\/code>/);
  assert.match(mainHtml, /<code>revisar<\/code>/);
  assert.match(mainHtml, /<code>explicar<\/code>/);

  // Não deve renderizar as seções de gráficos vazios no <main>
  assert.doesNotMatch(mainHtml, /id="secao-kpis"/);
  assert.doesNotMatch(mainHtml, /id="secao-radar"/);
  assert.doesNotMatch(mainHtml, /id="secao-evolucao"/);
  assert.doesNotMatch(mainHtml, /id="secao-calendario"/);
  assert.doesNotMatch(mainHtml, /id="secao-diario"/);
  assert.doesNotMatch(mainHtml, /<svg/);

  const dados = extrairJsonDados(html);
  assert.strictEqual(dados.resumo.totalAtividades, 0);
});

test('segurança (XSS): payloads maliciosos em resumo, projeto e conceitos são escapados no HTML e no JSON #dados', () => {
  const agora = new Date(2026, 9, 19, 15, 0, 0);
  const payloadResumo = '</script><img src=x onerror=alert(1)>';
  const payloadProjeto = '<script>evil()</script>';
  const payloadConceito = '"><svg onload=alert(1)>';

  const metricas = calcularMetricas({
    perfil: { nivel: 'junior', stack: '<img src=x onerror=alert(2)>', idioma: 'pt-BR' },
    diario: [
      {
        ts: dataLocalIso(2026, 10, 19, 12),
        projeto: payloadProjeto,
        tipo: 'revisao',
        nota: 7,
        areas: ['seguranca'],
        conceitos: [payloadConceito],
        resumo: payloadResumo,
      },
    ],
    trilha: trilhaPadrao,
    agora,
  });

  const html = gerarHtml(metricas, { geradoEm: agora, modo: 'estatico' });

  // Não pode conter as tags maliciosas sem escape
  assert.ok(!html.includes('</script><img'), 'Não deve conter </script><img sem escape');
  assert.ok(!html.includes('<img src=x onerror='), 'Não deve conter <img src=x onerror= sem escape');
  assert.ok(!html.includes('<script>evil()</script>'), 'Não deve conter <script>evil()</script> sem escape');
  assert.ok(!html.includes('"><svg onload=alert(1)>'), 'Não deve conter "><svg onload=alert(1)> sem escape');

  // Deve conter as versões escapadas no corpo HTML
  assert.ok(html.includes('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;evil()&lt;/script&gt;'));
  assert.ok(html.includes('&quot;&gt;&lt;svg onload=alert(1)&gt;'));

  // Deve haver exatamente 2 tags </script> no documento inteiro (#dados e script cliente)
  const fechamentosScript = html.match(/<\/script>/gi) || [];
  assert.strictEqual(fechamentosScript.length, 2);

  // O JSON em #dados deve continuar válido e preservar os valores originais após JSON.parse
  const dados = extrairJsonDados(html);
  assert.strictEqual(dados.atividadesRecentes.length, 1);
  assert.strictEqual(dados.atividadesRecentes[0].resumo, payloadResumo);
  assert.strictEqual(dados.atividadesRecentes[0].projeto, payloadProjeto);
  assert.deepStrictEqual(dados.atividadesRecentes[0].conceitos, [payloadConceito]);
});

test('isolamento offline: HTML gerado (com dados ou vazio, estático ou servidor) não faz requisições externas', () => {
  const agora = new Date(2026, 9, 19, 15, 0, 0);
  const metricasVazias = calcularMetricas({ diario: [], trilha: trilhaPadrao, agora });
  const metricasComDados = calcularMetricas({
    diario: [{ ts: dataLocalIso(2026, 10, 19), tipo: 'previsao', nota: 9, areas: ['testes'], resumo: 'ok' }],
    trilha: trilhaPadrao,
    agora,
  });

  const variantes = [
    gerarHtml(metricasVazias, { geradoEm: agora, modo: 'estatico' }),
    gerarHtml(metricasVazias, { geradoEm: agora, modo: 'servidor' }),
    gerarHtml(metricasComDados, { geradoEm: agora, modo: 'estatico' }),
    gerarHtml(metricasComDados, { geradoEm: agora, modo: 'servidor' }),
  ];

  for (const html of variantes) {
    assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']?\s*https?:/i, 'Não deve ter src= ou href= com http(s)');
    assert.doesNotMatch(html, /url\(\s*["']?\s*https?:/i, 'Não deve ter url() CSS com http(s)');
    assert.doesNotMatch(html, /@import\s+["']https?:/i, 'Não deve ter @import externo');
  }
});

test('CLI painel: cria arquivo com --saida e no caminho padrão exportDir()/painel.html sem --saida', () => {
  main(['registrar', '--tipo', 'previsao', '--nota', '8', '--areas', 'arquitetura', '--resumo', 'teste cli painel']);

  // Com --saida explícito
  const caminhoCustom = path.join(store.exportDir(), 'subpasta', 'meu-painel.html');
  const resCustom = main(['painel', '--saida', caminhoCustom]);
  assert.strictEqual(resCustom.codigo, 0);
  assert.strictEqual(resCustom.saida, path.resolve(caminhoCustom));
  assert.ok(fs.existsSync(caminhoCustom), 'Arquivo indicado em --saida deve existir');
  const conteudoCustom = fs.readFileSync(caminhoCustom, 'utf8');
  assert.match(conteudoCustom, /^<!DOCTYPE html>/);
  assert.match(conteudoCustom, /teste cli painel/);

  // Sem --saida (usa exportDir()/painel.html)
  const caminhoPadrao = path.join(store.exportDir(), 'painel.html');
  const resPadrao = main(['painel']);
  assert.strictEqual(resPadrao.codigo, 0);
  assert.strictEqual(resPadrao.saida, caminhoPadrao);
  assert.ok(fs.existsSync(caminhoPadrao), 'Arquivo painel.html padrão deve existir em exportDir()');
  const conteudoPadrao = fs.readFileSync(caminhoPadrao, 'utf8');
  assert.match(conteudoPadrao, /Scaffold Dev — Painel de estudo/);
});

test('modo ao vivo (iniciarServidorPainel): escuta em 127.0.0.1, serve /, /api/metricas em tempo real, 404 e fallback de porta', async () => {
  const srv = await iniciarServidorPainel({ porta: 0 });
  try {
    const endereco = srv.address();
    assert.strictEqual(endereco.address, '127.0.0.1', 'Servidor deve escutar apenas em 127.0.0.1');
    assert.ok(srv.porta > 0, 'Porta alocada deve ser maior que 0');

    // GET /
    const resRaiz = await requisitarHttp(`${srv.url}/`);
    assert.strictEqual(resRaiz.status, 200);
    assert.match(resRaiz.headers['content-type'] || '', /text\/html/i);
    assert.strictEqual(resRaiz.headers['cache-control'], 'no-store');
    assert.match(resRaiz.headers['content-security-policy'] || '', /default-src 'self'/);
    assert.match(resRaiz.corpo, /Ao vivo \(atualiza a cada 10s\)/);
    assert.match(resRaiz.corpo, /fetch\('\/api\/metricas'\)/);

    // GET /api/metricas inicial (vazio)
    const resApiInicial = await requisitarHttp(`${srv.url}/api/metricas`);
    assert.strictEqual(resApiInicial.status, 200);
    assert.match(resApiInicial.headers['content-type'] || '', /application\/json/i);
    assert.strictEqual(resApiInicial.headers['cache-control'], 'no-store');
    assert.match(resApiInicial.headers['content-security-policy'] || '', /default-src 'self'/);
    const metricasIniciais = JSON.parse(resApiInicial.corpo);
    assert.strictEqual(metricasIniciais.resumo.totalAtividades, 0);

    // Registra nova atividade via CLI e verifica atualização em tempo real no GET /api/metricas
    const reg = main(['registrar', '--tipo', 'revisao', '--nota', '7', '--areas', 'testes', '--resumo', 'atividade ao vivo']);
    assert.strictEqual(reg.codigo, 0);

    const resApiDepois = await requisitarHttp(`${srv.url}/api/metricas`);
    assert.strictEqual(resApiDepois.status, 200);
    const metricasDepois = JSON.parse(resApiDepois.corpo);
    assert.strictEqual(metricasDepois.resumo.totalAtividades, 1);
    assert.strictEqual(metricasDepois.resumo.mediaGeral, 7);
    assert.strictEqual(metricasDepois.porTipo.revisao.total, 1);
    assert.strictEqual(metricasDepois.porTipo.revisao.media, 7);
    assert.strictEqual(metricasDepois.atividadesRecentes[0].resumo, 'atividade ao vivo');

    // GET /rota-inexistente -> 404
    const res404 = await requisitarHttp(`${srv.url}/rota-inexistente`);
    assert.strictEqual(res404.status, 404);

    // Teste de fallback quando a porta inicial está ocupada em 127.0.0.1
    const srvConflito = await iniciarServidorPainel({ porta: srv.porta });
    try {
      assert.strictEqual(srvConflito.address().address, '127.0.0.1');
      assert.ok(
        srvConflito.porta > srv.porta && srvConflito.porta <= srv.porta + 10,
        `Esperava porta entre ${srv.porta + 1} e ${srv.porta + 10}, recebeu ${srvConflito.porta}`
      );
      const resConflito = await requisitarHttp(`${srvConflito.url}/api/metricas`);
      assert.strictEqual(resConflito.status, 200);
    } finally {
      await srvConflito.fechar();
    }
  } finally {
    await srv.fechar();
  }
});

test('script scripts/dev/dados-exemplo.js gera ~60 atividades e gerarHtml renderiza todas as seções sem erros', () => {
  const homeExemplo = path.join(store.dataDir(), 'exemplo-isolado');
  const resultado = gerarDadosExemplo({
    home: homeExemplo,
    total: 60,
    agora: new Date(2026, 9, 19, 15, 0, 0),
  });

  assert.strictEqual(resultado.total, 60);
  const perfil = store.lerPerfil();
  const diario = store.lerLinhas('diario.jsonl');
  assert.strictEqual(diario.length, 60);
  assert.strictEqual(perfil.stack, 'Node.js + PostgreSQL');

  const metricas = calcularMetricas({
    perfil,
    diario,
    trilha: trilhaPadrao,
    agora: new Date(2026, 9, 19, 15, 0, 0),
  });

  assert.strictEqual(metricas.resumo.totalAtividades, 60);
  assert.ok(metricas.lacunas.some((l) => l.id === 'seguranca'), 'seguranca deve aparecer nas lacunas (média < 6)');
  assert.ok(metricas.lacunas.some((l) => l.id === 'assincrono'), 'assincrono deve aparecer nas lacunas (sem prática)');

  const html = gerarHtml(metricas, { geradoEm: new Date(2026, 9, 19, 15, 0, 0), modo: 'estatico', perfil });
  for (const idSecao of [
    'secao-cabecalho',
    'secao-kpis',
    'secao-radar',
    'secao-evolucao',
    'secao-calendario',
    'secao-tipos',
    'secao-conceitos',
    'secao-lacunas',
    'secao-diario',
  ]) {
    assert.ok(html.includes(`id="${idSecao}"`), `HTML deve conter a seção ${idSecao}`);
  }
});
