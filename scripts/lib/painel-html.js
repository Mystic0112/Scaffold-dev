'use strict';

// Geração do painel HTML5 autocontido (CSS e JS inline, SVGs feitos à mão, zero dependências externas).

const NOMES_TIPOS = {
  previsao: 'Previsão',
  revisao: 'Revisão',
  explicacao: 'Explicação',
};

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializarJsonSeguro(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function formatarMedia(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return valor.toFixed(1);
}

function formatarDataHora(entrada) {
  const d = entrada instanceof Date ? entrada : new Date(entrada || Date.now());
  if (!Number.isFinite(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

function formatarDiaMes(dataIso) {
  const partes = String(dataIso || '').split('-');
  if (partes.length < 3) return String(dataIso || '');
  return `${partes[2].slice(0, 2)}/${partes[1]}`;
}

function formatarDataCurtaIso(ts) {
  if (!ts) return '—';
  const str = String(ts);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function normalizarMetricas(metricas = {}, opcoes = {}) {
  const m = metricas && typeof metricas === 'object' ? metricas : {};
  const p = opcoes.perfil || m.perfil || {};
  const r = m.resumo || {};
  const pt = m.porTipo || {};

  return {
    perfil: {
      nivel: p.nivel || 'junior',
      stack: p.stack || '',
      idioma: p.idioma || 'pt-BR',
    },
    resumo: {
      totalAtividades: Number(r.totalAtividades) || 0,
      mediaGeral: typeof r.mediaGeral === 'number' && Number.isFinite(r.mediaGeral) ? r.mediaGeral : null,
      ultimos7Dias: Number(r.ultimos7Dias) || 0,
      sequenciaAtual: Number(r.sequenciaAtual) || 0,
      melhorSequencia: Number(r.melhorSequencia) || 0,
    },
    porTipo: {
      previsao: {
        total: Number(pt.previsao?.total) || 0,
        media: typeof pt.previsao?.media === 'number' ? pt.previsao.media : null,
      },
      revisao: {
        total: Number(pt.revisao?.total) || 0,
        media: typeof pt.revisao?.media === 'number' ? pt.revisao.media : null,
      },
      explicacao: {
        total: Number(pt.explicacao?.total) || 0,
        media: typeof pt.explicacao?.media === 'number' ? pt.explicacao.media : null,
      },
    },
    areas: Array.isArray(m.areas) ? m.areas : [],
    evolucaoSemanal: Array.isArray(m.evolucaoSemanal) ? m.evolucaoSemanal : [],
    calendario: Array.isArray(m.calendario) ? m.calendario : [],
    conceitos: Array.isArray(m.conceitos) ? m.conceitos : [],
    lacunas: Array.isArray(m.lacunas) ? m.lacunas : [],
    proximoPasso: typeof m.proximoPasso === 'string' && m.proximoPasso
      ? m.proximoPasso
      : 'Continue praticando para consolidar a trilha.',
    atividadesRecentes: Array.isArray(m.atividadesRecentes) ? m.atividadesRecentes : [],
  };
}

function gerarSvgRadar(areas) {
  const lista = Array.isArray(areas) ? areas : [];
  const n = lista.length || 1;
  const cx = 220;
  const cy = 195;
  const raioMax = 120;
  const niveisGrade = [2, 4, 6, 8, 10];

  const circulosGrade = niveisGrade
    .map((nivel) => {
      const r = (nivel / 10) * raioMax;
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" class="radar-grade" />`;
    })
    .join('');

  const rotulosGrade = niveisGrade
    .map((nivel) => {
      const y = cy - (nivel / 10) * raioMax;
      return `<text x="${cx + 4}" y="${(y - 2).toFixed(1)}" class="radar-escala">${nivel}</text>`;
    })
    .join('');

  const eixos = [];
  const pontosComDados = [];
  const circulosPontos = [];
  const rotulos = [];

  for (let i = 0; i < lista.length; i++) {
    const area = lista[i];
    const ang = (2 * Math.PI * i) / n - Math.PI / 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const xFim = cx + raioMax * cos;
    const yFim = cy + raioMax * sin;
    const temDados = typeof area.media === 'number' && Number.isFinite(area.media);

    if (temDados) {
      eixos.push(
        `<line x1="${cx}" y1="${cy}" x2="${xFim.toFixed(1)}" y2="${yFim.toFixed(1)}" class="radar-eixo radar-eixo-ativo" data-area="${escaparHtml(area.id)}" data-status="com-dados" />`
      );
      const r = (Math.max(0, Math.min(10, area.media)) / 10) * raioMax;
      const px = cx + r * cos;
      const py = cy + r * sin;
      pontosComDados.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      circulosPontos.push(
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" class="radar-ponto" data-area="${escaparHtml(area.id)}" data-media="${area.media.toFixed(1)}"><title>${escaparHtml(area.nome)}: ${area.media.toFixed(1)}/10 (${area.total} registro(s))</title></circle>`
      );
    } else {
      // Áreas sem dados aparecem como eixo tracejado/cinza, nunca como zero.
      eixos.push(
        `<line x1="${cx}" y1="${cy}" x2="${xFim.toFixed(1)}" y2="${yFim.toFixed(1)}" class="radar-eixo radar-eixo-sem-dados" stroke-dasharray="4 4" data-area="${escaparHtml(area.id)}" data-status="sem-dados"><title>${escaparHtml(area.nome)}: sem dados</title></line>`
      );
    }

    const rTexto = raioMax + 22;
    const tx = cx + rTexto * cos;
    const ty = cy + rTexto * sin;
    let ancoragem = 'middle';
    if (cos > 0.25) ancoragem = 'start';
    else if (cos < -0.25) ancoragem = 'end';

    const nomeCurto = area.nome && area.nome.length > 22 ? `${area.nome.slice(0, 20)}…` : (area.nome || area.id);
    rotulos.push(
      `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="${ancoragem}" class="radar-rotulo ${temDados ? '' : 'radar-rotulo-sem-dados'}">${escaparHtml(nomeCurto)}</text>`
    );
  }

  let formaDados = '';
  if (pontosComDados.length >= 3) {
    formaDados = `<polygon points="${pontosComDados.join(' ')}" class="radar-poligono" />`;
  } else if (pontosComDados.length === 2) {
    formaDados = `<polyline points="${pontosComDados.join(' ')}" class="radar-poligono-linha" />`;
  }

  return `<svg viewBox="0 0 440 390" role="img" aria-label="Radar da trilha de competências em escala de 0 a 10" class="svg-radar">
    <title>Radar da trilha de competências (0 a 10)</title>
    ${circulosGrade}
    ${eixos.join('')}
    ${rotulosGrade}
    ${formaDados}
    ${circulosPontos.join('')}
    ${rotulos.join('')}
  </svg>`;
}

function gerarSvgEvolucaoSemanal(evolucaoSemanal) {
  const semanas = Array.isArray(evolucaoSemanal) ? evolucaoSemanal : [];
  const largura = 640;
  const altura = 240;
  const padEsq = 40;
  const padDir = 36;
  const padTopo = 24;
  const padBase = 42;
  const areaLarg = largura - padEsq - padDir;
  const areaAlt = altura - padTopo - padBase;
  const n = semanas.length || 1;
  const passoX = areaLarg / n;
  const maxTotal = Math.max(1, ...semanas.map((s) => Number(s.total) || 0));

  const linhasGrade = [0, 2.5, 5, 7.5, 10]
    .map((nota) => {
      const y = padTopo + areaAlt - (nota / 10) * areaAlt;
      return `<line x1="${padEsq}" y1="${y.toFixed(1)}" x2="${largura - padDir}" y2="${y.toFixed(1)}" class="evolucao-grade" />
      <text x="${padEsq - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="evolucao-eixo-texto">${nota}</text>`;
    })
    .join('');

  const barras = [];
  const rotulosX = [];
  const segmentos = [];
  let segmentoAtual = [];
  const pontosMedia = [];

  for (let i = 0; i < semanas.length; i++) {
    const s = semanas[i];
    const total = Number(s.total) || 0;
    const xCentro = padEsq + passoX * i + passoX / 2;
    const largBarra = Math.max(12, Math.min(28, passoX * 0.55));
    const altBarra = total > 0 ? Math.max(4, (total / maxTotal) * (areaAlt * 0.85)) : 0;
    const yBarra = padTopo + areaAlt - altBarra;

    barras.push(
      `<rect x="${(xCentro - largBarra / 2).toFixed(1)}" y="${yBarra.toFixed(1)}" width="${largBarra.toFixed(1)}" height="${altBarra.toFixed(1)}" rx="3" class="evolucao-barra" data-semana="${escaparHtml(s.semana)}" data-total="${total}"><title>${escaparHtml(s.semana)}: ${total} atividade(s)</title></rect>`
    );

    const rotuloSemana = String(s.semana || '').replace(/^\d{4}-/, '');
    rotulosX.push(
      `<text x="${xCentro.toFixed(1)}" y="${altura - 14}" text-anchor="middle" class="evolucao-eixo-texto">${escaparHtml(rotuloSemana)}</text>`
    );

    if (typeof s.media === 'number' && Number.isFinite(s.media)) {
      const yMedia = padTopo + areaAlt - (Math.max(0, Math.min(10, s.media)) / 10) * areaAlt;
      const pt = { x: xCentro, y: yMedia, semana: s.semana, media: s.media, total };
      segmentoAtual.push(pt);
      pontosMedia.push(pt);
    } else if (segmentoAtual.length > 0) {
      // Semana sem atividade abre uma lacuna na linha (nunca cai para zero).
      segmentos.push(segmentoAtual);
      segmentoAtual = [];
    }
  }
  if (segmentoAtual.length > 0) segmentos.push(segmentoAtual);

  const polilinhas = segmentos
    .filter((seg) => seg.length >= 2)
    .map((seg) => {
      const pts = seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" class="evolucao-linha" />`;
    })
    .join('');

  const circulos = pontosMedia
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" class="evolucao-ponto" data-semana="${escaparHtml(p.semana)}" data-media="${p.media.toFixed(1)}"><title>${escaparHtml(p.semana)}: média ${p.media.toFixed(1)}/10 (${p.total} atividade(s))</title></circle>`
    )
    .join('');

  return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de evolução semanal com volume de atividades em barras e média de notas em linha" class="svg-evolucao">
    <title>Evolução semanal das últimas 12 semanas ISO</title>
    ${linhasGrade}
    ${barras.join('')}
    ${polilinhas}
    ${circulos}
    ${rotulosX.join('')}
  </svg>`;
}

function nivelHeatmap(total) {
  const n = Number(total) || 0;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}

function textoTooltipCalendario(dataIso, total) {
  const n = Number(total) || 0;
  const palavra = n === 1 ? 'atividade' : 'atividades';
  return `${n} ${palavra} em ${formatarDiaMes(dataIso)}`;
}

function gerarSvgCalendario(calendario) {
  const dias = Array.isArray(calendario) ? calendario : [];
  const tam = 13;
  const gap = 3;
  const passo = tam + gap;
  const colunas = Math.max(1, Math.ceil(dias.length / 7));
  const largura = colunas * passo + 16;
  const altura = 7 * passo + 16;

  const celulas = dias
    .map((d, idx) => {
      const col = Math.floor(idx / 7);
      const lin = idx % 7;
      const x = 8 + col * passo;
      const y = 8 + lin * passo;
      const total = Number(d.total) || 0;
      const nivel = nivelHeatmap(total);
      const tooltip = textoTooltipCalendario(d.data, total);
      return `<rect x="${x}" y="${y}" width="${tam}" height="${tam}" rx="2.5" class="cal-celula cal-nivel-${nivel}" data-data="${escaparHtml(d.data)}" data-total="${total}" data-nivel="${nivel}" title="${escaparHtml(tooltip)}" aria-label="${escaparHtml(tooltip)}"><title>${escaparHtml(tooltip)}</title></rect>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Calendário de atividades dos últimos 6 meses (182 dias)" class="svg-calendario">
    <title>Calendário de atividade dos últimos 182 dias</title>
    ${celulas}
  </svg>`;
}

function renderizarEstadoVazio() {
  return `<section class="secao estado-vazio" id="estado-vazio" aria-labelledby="titulo-estado-vazio">
    <h2 id="titulo-estado-vazio">Comece sua jornada no Scaffold Dev</h2>
    <p>Nenhuma atividade registrada ainda no seu diário de estudo. Pratique com o código real do seu trabalho usando os três modos:</p>
    <div class="grade-passos-vazio">
      <article class="cartao-passo">
        <h3>1. Prever (<code>prever</code>)</h3>
        <p>Antes de o agente implementar uma tarefa, escreva como você resolveria e depois compare as abordagens.</p>
      </article>
      <article class="cartao-passo">
        <h3>2. Revisar (<code>revisar</code>)</h3>
        <p>Faça code review das mudanças geradas pelo agente e receba feedback sobre o que você encontrou.</p>
      </article>
      <article class="cartao-passo">
        <h3>3. Explicar (<code>explicar</code>)</h3>
        <p>Use a técnica de Feynman para explicar com suas próprias palavras como um trecho ou arquitetura funciona.</p>
      </article>
    </div>
  </section>`;
}

function renderizarSecoesPrincipais(m) {
  const { resumo, porTipo, areas, evolucaoSemanal, calendario, conceitos, lacunas, proximoPasso, atividadesRecentes } = m;
  const mediaGeralTexto = formatarMedia(resumo.mediaGeral);
  const seqAtual = resumo.sequenciaAtual;
  const mapaNomesAreas = new Map(areas.map((a) => [a.id, a.nome]));

  // Seção 2: Cartões (KPIs)
  const secaoKpis = `<section class="secao" id="secao-kpis" aria-labelledby="titulo-kpis">
    <h2 id="titulo-kpis" class="sr-only">Indicadores principais</h2>
    <div class="grade-kpis">
      <article class="cartao-kpi">
        <span class="kpi-rotulo">Total de atividades</span>
        <strong class="kpi-valor" id="kpi-total">${resumo.totalAtividades}</strong>
        <span class="kpi-detalhe">registradas no diário</span>
      </article>
      <article class="cartao-kpi">
        <span class="kpi-rotulo">Média geral</span>
        <strong class="kpi-valor" id="kpi-media">${mediaGeralTexto}</strong>
        <span class="kpi-detalhe">escala de 0 a 10</span>
      </article>
      <article class="cartao-kpi">
        <span class="kpi-rotulo">Sequência atual</span>
        <strong class="kpi-valor" id="kpi-sequencia">🔥 ${seqAtual} dias${seqAtual === 1 ? ' (1 dia)' : ''}</strong>
        <span class="kpi-detalhe" id="kpi-melhor-sequencia">Melhor sequência: ${resumo.melhorSequencia} dia(s)</span>
      </article>
      <article class="cartao-kpi">
        <span class="kpi-rotulo">Últimos 7 dias</span>
        <strong class="kpi-valor" id="kpi-ultimos7">${resumo.ultimos7Dias}</strong>
        <span class="kpi-detalhe">atividades recentes</span>
      </article>
    </div>
  </section>`;

  // Seção 3: Radar da trilha + tabela acessível
  const linhasRadar = areas
    .map((a) => {
      const temMedia = typeof a.media === 'number' && Number.isFinite(a.media);
      return `<tr>
        <td>${escaparHtml(a.nome)}</td>
        <td>${temMedia ? a.media.toFixed(1) : '—'}</td>
        <td>${Number(a.total) || 0}</td>
      </tr>`;
    })
    .join('');

  const secaoRadar = `<section class="secao" id="secao-radar" aria-labelledby="titulo-radar">
    <div class="secao-topo">
      <h2 id="titulo-radar">Radar da trilha</h2>
      <p class="secao-subtitulo">Desempenho nas 11 áreas (0–10). Eixos tracejados indicam áreas ainda sem registros.</p>
    </div>
    <div class="grade-radar">
      <div class="container-svg" id="container-svg-radar">
        ${gerarSvgRadar(areas)}
      </div>
      <div class="container-tabela-radar">
        <table class="tabela-dados" id="tabela-radar" aria-label="Desempenho por área da trilha">
          <thead>
            <tr>
              <th scope="col">Área</th>
              <th scope="col">Média</th>
              <th scope="col">Registros</th>
            </tr>
          </thead>
          <tbody id="corpo-tabela-radar">
            ${linhasRadar}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;

  // Seção 4: Evolução semanal + tabela equivalente acessível
  const linhasEvolucao = evolucaoSemanal
    .map((s) => {
      const temMedia = typeof s.media === 'number' && Number.isFinite(s.media);
      return `<tr>
        <td>${escaparHtml(s.semana)}</td>
        <td>${Number(s.total) || 0}</td>
        <td>${temMedia ? s.media.toFixed(1) : '—'}</td>
      </tr>`;
    })
    .join('');

  const secaoEvolucao = `<section class="secao" id="secao-evolucao" aria-labelledby="titulo-evolucao">
    <div class="secao-topo">
      <h2 id="titulo-evolucao">Evolução semanal</h2>
      <p class="secao-subtitulo">Volume de atividades (barras) e nota média (linha) nas últimas 12 semanas ISO.</p>
    </div>
    <div class="container-svg" id="container-svg-evolucao">
      ${gerarSvgEvolucaoSemanal(evolucaoSemanal)}
    </div>
    <details class="detalhes-acessivel">
      <summary>Ver tabela de evolução semanal</summary>
      <table class="tabela-dados" id="tabela-evolucao" aria-label="Evolução semanal nas últimas 12 semanas">
        <thead>
          <tr>
            <th scope="col">Semana ISO</th>
            <th scope="col">Atividades</th>
            <th scope="col">Média</th>
          </tr>
        </thead>
        <tbody id="corpo-tabela-evolucao">
          ${linhasEvolucao}
        </tbody>
      </table>
    </details>
  </section>`;

  // Seção 5: Calendário de atividade (182 dias)
  const secaoCalendario = `<section class="secao" id="secao-calendario" aria-labelledby="titulo-calendario">
    <div class="secao-topo">
      <h2 id="titulo-calendario">Calendário de atividade</h2>
      <p class="secao-subtitulo">Frequência diária nos últimos 6 meses (182 dias).</p>
    </div>
    <div class="container-svg container-calendario" id="container-svg-calendario">
      ${gerarSvgCalendario(calendario)}
    </div>
    <div class="legenda-calendario" aria-label="Legenda de intensidade">
      <span>Menos</span>
      <span class="amostra-cal cal-nivel-0" title="0 atividades"></span>
      <span class="amostra-cal cal-nivel-1" title="1 atividade"></span>
      <span class="amostra-cal cal-nivel-2" title="2 atividades"></span>
      <span class="amostra-cal cal-nivel-3" title="3 atividades"></span>
      <span class="amostra-cal cal-nivel-4" title="4+ atividades"></span>
      <span>Mais</span>
    </div>
  </section>`;

  // Seção 6: Por tipo
  const tiposOrdem = ['previsao', 'revisao', 'explicacao'];
  const maxTipoTotal = Math.max(1, ...tiposOrdem.map((t) => Number(porTipo[t]?.total) || 0));
  const barrasTipos = tiposOrdem
    .map((chave) => {
      const info = porTipo[chave] || { total: 0, media: null };
      const total = Number(info.total) || 0;
      const mediaTexto = formatarMedia(info.media);
      const perc = info.media !== null ? Math.round((info.media / 10) * 100) : Math.round((total / maxTipoTotal) * 100);
      return `<div class="linha-barra" data-tipo="${chave}">
        <div class="linha-barra-topo">
          <span class="linha-barra-nome">${escaparHtml(NOMES_TIPOS[chave])} (<code>${chave}</code>)</span>
          <span class="linha-barra-meta">Total: <strong>${total}</strong> · Média: <strong>${mediaTexto}</strong></span>
        </div>
        <div class="trilho-barra" role="progressbar" aria-label="${escaparHtml(NOMES_TIPOS[chave])}" aria-valuenow="${perc}" aria-valuemin="0" aria-valuemax="100">
          <div class="preenchimento-barra preenchimento-${chave}" style="width: ${perc}%"></div>
        </div>
      </div>`;
    })
    .join('');

  const secaoTipos = `<section class="secao" id="secao-tipos" aria-labelledby="titulo-tipos">
    <div class="secao-topo">
      <h2 id="titulo-tipos">Por tipo de prática</h2>
      <p class="secao-subtitulo">Distribuição entre previsão, revisão e explicação.</p>
    </div>
    <div class="lista-barras" id="container-tipos">
      ${barrasTipos}
    </div>
  </section>`;

  // Seção 7: Conceitos mais estudados
  const maxConceito = Math.max(1, ...conceitos.map((c) => Number(c.vezes) || 0));
  const itensConceitos = conceitos.length
    ? conceitos
        .slice(0, 15)
        .map((c) => {
          const vezes = Number(c.vezes) || 0;
          const perc = Math.max(6, Math.round((vezes / maxConceito) * 100));
          return `<li class="item-conceito">
            <div class="linha-barra-topo">
              <span class="conceito-nome">${escaparHtml(c.nome)}</span>
              <span class="conceito-vezes">${vezes}x</span>
            </div>
            <div class="trilho-barra">
              <div class="preenchimento-barra preenchimento-conceito" style="width: ${perc}%"></div>
            </div>
          </li>`;
        })
        .join('')
    : '<li class="item-vazio">Nenhum conceito registrado ainda.</li>';

  const secaoConceitos = `<section class="secao" id="secao-conceitos" aria-labelledby="titulo-conceitos">
    <div class="secao-topo">
      <h2 id="titulo-conceitos">Conceitos mais estudados</h2>
      <p class="secao-subtitulo">Top 15 conceitos praticados no diário.</p>
    </div>
    <ul class="lista-conceitos" id="lista-conceitos">
      ${itensConceitos}
    </ul>
  </section>`;

  // Seção 8: Lacunas e próximo passo
  const itensLacunas = lacunas.length
    ? lacunas
        .map((l) => {
          const semPratica = !l.total || l.media === null;
          const motivo = semPratica
            ? 'Ainda não praticada (0 registros)'
            : `Média baixa: ${Number(l.media).toFixed(1)}/10 (${l.total} registros)`;
          return `<li class="item-lacuna ${semPratica ? 'lacuna-inedita' : 'lacuna-baixa'}">
            <strong>${escaparHtml(l.nome)}</strong>
            <span class="lacuna-motivo">${escaparHtml(motivo)}</span>
          </li>`;
        })
        .join('')
    : '<li class="item-vazio">Nenhuma lacuna identificada — excelente cobertura!</li>';

  const secaoLacunas = `<section class="secao" id="secao-lacunas" aria-labelledby="titulo-lacunas">
    <div class="secao-topo">
      <h2 id="titulo-lacunas">Lacunas e próximo passo</h2>
      <p class="secao-subtitulo">Onde focar sua próxima sessão deliberada.</p>
    </div>
    <div class="destaque-proximo-passo" id="destaque-proximo-passo">
      <span class="rotulo-destaque">Próximo passo recomendado</span>
      <p class="texto-proximo-passo" id="texto-proximo-passo">${escaparHtml(proximoPasso)}</p>
    </div>
    <ul class="lista-lacunas" id="lista-lacunas">
      ${itensLacunas}
    </ul>
  </section>`;

  // Seção 9: Diário de atividades recentes
  const projetosUnicos = [...new Set(atividadesRecentes.map((a) => a.projeto).filter(Boolean))].sort();
  const opcoesAreas = areas
    .map((a) => `<option value="${escaparHtml(a.id)}">${escaparHtml(a.nome)}</option>`)
    .join('');
  const opcoesProjetos = projetosUnicos
    .map((p) => `<option value="${escaparHtml(p)}">${escaparHtml(p)}</option>`)
    .join('');

  const linhasDiario = atividadesRecentes.length
    ? atividadesRecentes
        .map((item) => {
          const listaAreas = Array.isArray(item.areas) ? item.areas : [];
          const nomesAreas = listaAreas.map((id) => mapaNomesAreas.get(id) || id).join(', ');
          const listaConceitos = Array.isArray(item.conceitos) ? item.conceitos.join(', ') : '';
          const notaNum = typeof item.nota === 'number' ? item.nota : '';
          return `<tr data-tipo="${escaparHtml(item.tipo || '')}" data-areas="${escaparHtml(listaAreas.join(','))}" data-projeto="${escaparHtml(item.projeto || '')}">
            <td>${escaparHtml(formatarDataCurtaIso(item.ts))}</td>
            <td>${escaparHtml(item.projeto || '—')}</td>
            <td><span class="badge-tipo badge-${escaparHtml(item.tipo || '')}">${escaparHtml(NOMES_TIPOS[item.tipo] || item.tipo || '—')}</span></td>
            <td><strong>${escaparHtml(notaNum)}</strong>/10</td>
            <td>${escaparHtml(nomesAreas || '—')}</td>
            <td>${escaparHtml(listaConceitos || '—')}</td>
            <td class="celula-resumo">${escaparHtml(item.resumo || '—')}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="7" class="item-vazio">Nenhuma atividade encontrada.</td></tr>';

  const secaoDiario = `<section class="secao" id="secao-diario" aria-labelledby="titulo-diario">
    <div class="secao-topo">
      <h2 id="titulo-diario">Diário de atividades</h2>
      <p class="secao-subtitulo">Últimas ${atividadesRecentes.length} atividades registradas.</p>
    </div>
    <form class="barra-filtros" id="form-filtros-diario" onsubmit="return false;">
      <div class="campo-filtro">
        <label for="filtro-tipo">Tipo</label>
        <select id="filtro-tipo" name="tipo">
          <option value="">Todos os tipos</option>
          <option value="previsao">Previsão</option>
          <option value="revisao">Revisão</option>
          <option value="explicacao">Explicação</option>
        </select>
      </div>
      <div class="campo-filtro">
        <label for="filtro-area">Área</label>
        <select id="filtro-area" name="area">
          <option value="">Todas as áreas</option>
          ${opcoesAreas}
        </select>
      </div>
      <div class="campo-filtro">
        <label for="filtro-projeto">Projeto</label>
        <select id="filtro-projeto" name="projeto">
          <option value="">Todos os projetos</option>
          ${opcoesProjetos}
        </select>
      </div>
      <div class="campo-filtro campo-busca">
        <label for="filtro-busca">Buscar no resumo</label>
        <input type="search" id="filtro-busca" name="busca" placeholder="Filtrar por texto no resumo..." autocomplete="off" />
      </div>
    </form>
    <div class="container-tabela-rolavel">
      <table class="tabela-dados" id="tabela-diario" aria-label="Atividades recentes do diário">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Projeto</th>
            <th scope="col">Tipo</th>
            <th scope="col">Nota</th>
            <th scope="col">Áreas</th>
            <th scope="col">Conceitos</th>
            <th scope="col">Resumo</th>
          </tr>
        </thead>
        <tbody id="corpo-diario">
          ${linhasDiario}
        </tbody>
      </table>
    </div>
  </section>`;

  return [
    secaoKpis,
    secaoRadar,
    secaoEvolucao,
    secaoCalendario,
    `<div class="grade-dupla">${secaoTipos}${secaoConceitos}</div>`,
    secaoLacunas,
    secaoDiario,
  ].join('\n');
}

function gerarCssInline() {
  return `
    :root {
      --bg-pagina: #f8fafc;
      --bg-cartao: #ffffff;
      --bg-destaque: #eff6ff;
      --bg-sutil: #f1f5f9;
      --texto-principal: #0f172a;
      --texto-secundario: #475569;
      --texto-suave: #64748b;
      --borda: #cbd5e1;
      --borda-suave: #e2e8f0;
      --primaria: #1d4ed8;
      --primaria-clara: rgba(29, 78, 216, 0.18);
      --acento-previsao: #0284c7;
      --acento-revisao: #2563eb;
      --acento-explicacao: #7c3aed;
      --alerta-bg: #fef2f2;
      --alerta-texto: #991b1b;
      --alerta-borda: #fecaca;
      --cal-0: #e2e8f0;
      --cal-1: #bbf7d0;
      --cal-2: #4ade80;
      --cal-3: #16a34a;
      --cal-4: #14532d;
      --sombra: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-pagina: #0b1120;
        --bg-cartao: #111827;
        --bg-destaque: #1e293b;
        --bg-sutil: #1f2937;
        --texto-principal: #f8fafc;
        --texto-secundario: #cbd5e1;
        --texto-suave: #94a3b8;
        --borda: #334155;
        --borda-suave: #1e293b;
        --primaria: #60a5fa;
        --primaria-clara: rgba(96, 165, 250, 0.22);
        --acento-previsao: #38bdf8;
        --acento-revisao: #60a5fa;
        --acento-explicacao: #a78bfa;
        --alerta-bg: #2c1519;
        --alerta-texto: #fca5a5;
        --alerta-borda: #7f1d1d;
        --cal-0: #1e293b;
        --cal-1: #064e3b;
        --cal-2: #047857;
        --cal-3: #10b981;
        --cal-4: #34d399;
        --sombra: 0 1px 4px rgba(0, 0, 0, 0.4);
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-pagina);
      color: var(--texto-principal);
      line-height: 1.5;
    }

    .container-pagina {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: var(--bg-cartao);
      border: 1px solid var(--borda-suave);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: var(--sombra);
    }

    .cabecalho h1 {
      margin: 0 0 6px 0;
      font-size: 1.5rem;
    }

    .metadados-perfil {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 0.92rem;
      color: var(--texto-secundario);
    }

    .badge-info {
      background: var(--bg-sutil);
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid var(--borda);
      font-weight: 500;
    }

    .badge-ao-vivo {
      background: var(--bg-destaque);
      color: var(--primaria);
      border-color: var(--primaria);
    }

    .secao {
      background: var(--bg-cartao);
      border: 1px solid var(--borda-suave);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: var(--sombra);
    }

    .secao-topo h2 {
      margin: 0 0 4px 0;
      font-size: 1.2rem;
    }

    .secao-subtitulo {
      margin: 0 0 16px 0;
      font-size: 0.9rem;
      color: var(--texto-secundario);
    }

    .grade-kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .cartao-kpi {
      background: var(--bg-sutil);
      border: 1px solid var(--borda-suave);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-rotulo {
      font-size: 0.85rem;
      color: var(--texto-secundario);
      font-weight: 600;
    }

    .kpi-valor {
      font-size: 1.8rem;
      color: var(--texto-principal);
      line-height: 1.2;
    }

    .kpi-detalhe {
      font-size: 0.8rem;
      color: var(--texto-suave);
    }

    .grade-radar {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: center;
    }

    .grade-dupla {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .container-svg {
      width: 100%;
      overflow-x: auto;
      display: flex;
      justify-content: center;
    }

    svg {
      max-width: 100%;
      height: auto;
    }

    .radar-grade {
      fill: none;
      stroke: var(--borda-suave);
      stroke-width: 1;
    }

    .radar-eixo-ativo {
      stroke: var(--borda);
      stroke-width: 1.2;
    }

    .radar-eixo-sem-dados {
      stroke: var(--texto-suave);
      stroke-width: 1;
      opacity: 0.65;
    }

    .radar-poligono {
      fill: var(--primaria-clara);
      stroke: var(--primaria);
      stroke-width: 2.2;
    }

    .radar-poligono-linha {
      fill: none;
      stroke: var(--primaria);
      stroke-width: 2.2;
    }

    .radar-ponto {
      fill: var(--primaria);
      stroke: var(--bg-cartao);
      stroke-width: 1.5;
    }

    .radar-rotulo {
      font-size: 11px;
      fill: var(--texto-principal);
      font-weight: 500;
    }

    .radar-rotulo-sem-dados {
      fill: var(--texto-suave);
    }

    .radar-escala {
      font-size: 9px;
      fill: var(--texto-suave);
    }

    .evolucao-grade {
      stroke: var(--borda-suave);
      stroke-width: 1;
    }

    .evolucao-eixo-texto {
      font-size: 11px;
      fill: var(--texto-secundario);
    }

    .evolucao-barra {
      fill: var(--primaria-clara);
      stroke: var(--borda);
      stroke-width: 1;
    }

    .evolucao-linha {
      fill: none;
      stroke: var(--primaria);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .evolucao-ponto {
      fill: var(--primaria);
      stroke: var(--bg-cartao);
      stroke-width: 2;
    }

    .cal-nivel-0 { fill: var(--cal-0); background-color: var(--cal-0); }
    .cal-nivel-1 { fill: var(--cal-1); background-color: var(--cal-1); }
    .cal-nivel-2 { fill: var(--cal-2); background-color: var(--cal-2); }
    .cal-nivel-3 { fill: var(--cal-3); background-color: var(--cal-3); }
    .cal-nivel-4 { fill: var(--cal-4); background-color: var(--cal-4); }

    .legenda-calendario {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 10px;
      font-size: 0.8rem;
      color: var(--texto-secundario);
    }

    .amostra-cal {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .lista-barras, .lista-conceitos, .lista-lacunas {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .linha-barra-topo {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      margin-bottom: 4px;
    }

    .trilho-barra {
      width: 100%;
      height: 10px;
      background: var(--bg-sutil);
      border-radius: 999px;
      overflow: hidden;
    }

    .preenchimento-barra {
      height: 100%;
      background: var(--primaria);
      border-radius: 999px;
    }

    .preenchimento-previsao { background: var(--acento-previsao); }
    .preenchimento-revisao { background: var(--acento-revisao); }
    .preenchimento-explicacao { background: var(--acento-explicacao); }

    .destaque-proximo-passo {
      background: var(--bg-destaque);
      border-left: 4px solid var(--primaria);
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .rotulo-destaque {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--primaria);
      font-weight: 700;
    }

    .texto-proximo-passo {
      margin: 4px 0 0 0;
      font-size: 1.05rem;
      font-weight: 600;
    }

    .item-lacuna {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--bg-sutil);
      border: 1px solid var(--borda-suave);
    }

    .lacuna-baixa {
      background: var(--alerta-bg);
      color: var(--alerta-texto);
      border-color: var(--alerta-borda);
    }

    .barra-filtros {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .campo-filtro {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .campo-filtro label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--texto-secundario);
    }

    .campo-filtro select,
    .campo-filtro input {
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--borda);
      background: var(--bg-pagina);
      color: var(--texto-principal);
      font-size: 0.9rem;
    }

    .container-tabela-rolavel {
      width: 100%;
      overflow-x: auto;
    }

    .tabela-dados {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }

    .tabela-dados th,
    .tabela-dados td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--borda-suave);
    }

    .tabela-dados th {
      font-weight: 600;
      color: var(--texto-secundario);
      background: var(--bg-sutil);
    }

    .badge-tipo {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--bg-sutil);
      border: 1px solid var(--borda);
    }

    .grade-passos-vazio {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
    }

    .cartao-passo {
      background: var(--bg-sutil);
      border: 1px solid var(--borda-suave);
      border-radius: 10px;
      padding: 16px;
    }

    .cartao-passo h3 {
      margin-top: 0;
      font-size: 1rem;
    }

    @media (max-width: 640px) {
      .container-pagina {
        padding: 12px;
      }
      .cabecalho,
      .secao {
        padding: 16px;
      }
      .grade-kpis,
      .grade-radar,
      .grade-dupla,
      .barra-filtros,
      .grade-passos-vazio {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function gerarScriptCliente(modo) {
  return `
  (function () {
    'use strict';
    var MODO = ${JSON.stringify(modo === 'servidor' ? 'servidor' : 'estatico')};
    var NOMES_TIPOS = { previsao: 'Previsão', revisao: 'Revisão', explicacao: 'Explicação' };
    var escaparHtml = ${escaparHtml.toString()};
    var formatarMedia = ${formatarMedia.toString()};
    var formatarDiaMes = ${formatarDiaMes.toString()};
    var formatarDataCurtaIso = ${formatarDataCurtaIso.toString()};
    var nivelHeatmap = ${nivelHeatmap.toString()};
    var textoTooltipCalendario = ${textoTooltipCalendario.toString()};
    var gerarSvgRadar = ${gerarSvgRadar.toString()};
    var gerarSvgEvolucaoSemanal = ${gerarSvgEvolucaoSemanal.toString()};
    var gerarSvgCalendario = ${gerarSvgCalendario.toString()};
    var renderizarSecoesPrincipais = ${renderizarSecoesPrincipais.toString()};

    var elDados = document.getElementById('dados');
    var estadoMetricas = null;
    try {
      estadoMetricas = elDados ? JSON.parse(elDados.textContent) : null;
    } catch (e) {
      estadoMetricas = null;
    }

    function obterEstadoFiltros() {
      var elTipo = document.getElementById('filtro-tipo');
      var elArea = document.getElementById('filtro-area');
      var elProjeto = document.getElementById('filtro-projeto');
      var elBusca = document.getElementById('filtro-busca');
      return {
        tipo: elTipo ? elTipo.value : '',
        area: elArea ? elArea.value : '',
        projeto: elProjeto ? elProjeto.value : '',
        busca: elBusca ? elBusca.value : '',
      };
    }

    function restaurarEstadoFiltros(filtros) {
      if (!filtros) return;
      var elTipo = document.getElementById('filtro-tipo');
      var elArea = document.getElementById('filtro-area');
      var elProjeto = document.getElementById('filtro-projeto');
      var elBusca = document.getElementById('filtro-busca');
      if (elTipo) elTipo.value = filtros.tipo || '';
      if (elArea) elArea.value = filtros.area || '';
      if (elProjeto) elProjeto.value = filtros.projeto || '';
      if (elBusca) elBusca.value = filtros.busca || '';
    }

    function aplicarFiltrosDiario() {
      if (!estadoMetricas) return;
      var corpo = document.getElementById('corpo-diario');
      if (!corpo) return;

      var filtros = obterEstadoFiltros();
      var buscaMin = (filtros.busca || '').trim().toLowerCase();
      var mapaAreas = new Map();
      var areas = Array.isArray(estadoMetricas.areas) ? estadoMetricas.areas : [];
      for (var i = 0; i < areas.length; i++) {
        mapaAreas.set(areas[i].id, areas[i].nome);
      }

      var lista = Array.isArray(estadoMetricas.atividadesRecentes) ? estadoMetricas.atividadesRecentes : [];
      var filtradas = lista.filter(function (item) {
        if (filtros.tipo && item.tipo !== filtros.tipo) return false;
        if (filtros.projeto && item.projeto !== filtros.projeto) return false;
        if (filtros.area) {
          var itemAreas = Array.isArray(item.areas) ? item.areas : [];
          if (itemAreas.indexOf(filtros.area) === -1) return false;
        }
        if (buscaMin) {
          var resumo = String(item.resumo || '').toLowerCase();
          if (resumo.indexOf(buscaMin) === -1) return false;
        }
        return true;
      });

      while (corpo.firstChild) corpo.removeChild(corpo.firstChild);

      if (filtradas.length === 0) {
        var trVazia = document.createElement('tr');
        var tdVazia = document.createElement('td');
        tdVazia.colSpan = 7;
        tdVazia.className = 'item-vazio';
        tdVazia.textContent = 'Nenhuma atividade corresponde aos filtros selecionados.';
        trVazia.appendChild(tdVazia);
        corpo.appendChild(trVazia);
        return;
      }

      for (var j = 0; j < filtradas.length; j++) {
        var it = filtradas[j];
        var tr = document.createElement('tr');
        var arrAreas = Array.isArray(it.areas) ? it.areas : [];
        tr.setAttribute('data-tipo', it.tipo || '');
        tr.setAttribute('data-areas', arrAreas.join(','));
        tr.setAttribute('data-projeto', it.projeto || '');

        var tdData = document.createElement('td');
        tdData.textContent = formatarDataCurtaIso(it.ts);
        tr.appendChild(tdData);

        var tdProj = document.createElement('td');
        tdProj.textContent = it.projeto || '—';
        tr.appendChild(tdProj);

        var tdTipo = document.createElement('td');
        var spanBadge = document.createElement('span');
        spanBadge.className = 'badge-tipo badge-' + (it.tipo || '');
        spanBadge.textContent = NOMES_TIPOS[it.tipo] || it.tipo || '—';
        tdTipo.appendChild(spanBadge);
        tr.appendChild(tdTipo);

        var tdNota = document.createElement('td');
        var strongNota = document.createElement('strong');
        strongNota.textContent = typeof it.nota === 'number' ? String(it.nota) : '—';
        tdNota.appendChild(strongNota);
        tdNota.appendChild(document.createTextNode('/10'));
        tr.appendChild(tdNota);

        var tdAreas = document.createElement('td');
        var nomesAreas = arrAreas.map(function (id) { return mapaAreas.get(id) || id; }).join(', ');
        tdAreas.textContent = nomesAreas || '—';
        tr.appendChild(tdAreas);

        var tdConceitos = document.createElement('td');
        tdConceitos.textContent = Array.isArray(it.conceitos) && it.conceitos.length ? it.conceitos.join(', ') : '—';
        tr.appendChild(tdConceitos);

        var tdResumo = document.createElement('td');
        tdResumo.className = 'celula-resumo';
        tdResumo.textContent = it.resumo || '—';
        tr.appendChild(tdResumo);

        corpo.appendChild(tr);
      }
    }

    function conectarEventosFiltros() {
      var ids = ['filtro-tipo', 'filtro-area', 'filtro-projeto', 'filtro-busca'];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) {
          el.addEventListener('input', aplicarFiltrosDiario);
          el.addEventListener('change', aplicarFiltrosDiario);
        }
      }
    }

    function atualizarOpcoesProjetoPreservando(projetoSelecionado) {
      var selectProj = document.getElementById('filtro-projeto');
      if (!selectProj || !estadoMetricas) return;
      var recentes = Array.isArray(estadoMetricas.atividadesRecentes) ? estadoMetricas.atividadesRecentes : [];
      var conj = {};
      for (var i = 0; i < recentes.length; i++) {
        if (recentes[i].projeto) conj[recentes[i].projeto] = true;
      }
      var projetos = Object.keys(conj).sort();
      while (selectProj.firstChild) selectProj.removeChild(selectProj.firstChild);

      var optTodos = document.createElement('option');
      optTodos.value = '';
      optTodos.textContent = 'Todos os projetos';
      selectProj.appendChild(optTodos);

      for (var j = 0; j < projetos.length; j++) {
        var opt = document.createElement('option');
        opt.value = projetos[j];
        opt.textContent = projetos[j];
        selectProj.appendChild(opt);
      }
      selectProj.value = projetoSelecionado || '';
    }

    function atualizarDomAoVivo(novasMetricas) {
      if (!novasMetricas || typeof novasMetricas !== 'object') return;
      var filtrosAtuais = obterEstadoFiltros();
      estadoMetricas = novasMetricas;

      if (elDados) {
        elDados.textContent = JSON.stringify(novasMetricas);
      }

      var elNivel = document.getElementById('perfil-nivel');
      if (elNivel && novasMetricas.perfil) elNivel.textContent = novasMetricas.perfil.nivel || 'junior';

      var elStack = document.getElementById('perfil-stack');
      if (elStack && novasMetricas.perfil) elStack.textContent = novasMetricas.perfil.stack || 'não definida';

      var elAtualizado = document.getElementById('atualizado-em');
      if (elAtualizado) {
        var agora = new Date();
        elAtualizado.textContent = 'atualizado em ' + agora.toLocaleTimeString('pt-BR');
      }

      var r = novasMetricas.resumo || {};
      var main = document.getElementById('conteudo-principal');
      if (main && (r.totalAtividades || 0) > 0 && document.getElementById('estado-vazio')) {
        main.innerHTML = renderizarSecoesPrincipais(novasMetricas);
        conectarEventosFiltros();
      }

      var elTotal = document.getElementById('kpi-total');
      if (elTotal) elTotal.textContent = String(r.totalAtividades || 0);

      var elMedia = document.getElementById('kpi-media');
      if (elMedia) elMedia.textContent = typeof r.mediaGeral === 'number' ? r.mediaGeral.toFixed(1) : '—';

      var elSeq = document.getElementById('kpi-sequencia');
      if (elSeq) {
        var s = r.sequenciaAtual || 0;
        elSeq.textContent = '🔥 ' + s + ' dias' + (s === 1 ? ' (1 dia)' : '');
      }

      var elMelhor = document.getElementById('kpi-melhor-sequencia');
      if (elMelhor) elMelhor.textContent = 'Melhor sequência: ' + (r.melhorSequencia || 0) + ' dia(s)';

      var elUlt7 = document.getElementById('kpi-ultimos7');
      if (elUlt7) elUlt7.textContent = String(r.ultimos7Dias || 0);

      var contRadar = document.getElementById('container-svg-radar');
      if (contRadar && Array.isArray(novasMetricas.areas)) {
        contRadar.innerHTML = gerarSvgRadar(novasMetricas.areas);
      }

      var contEvol = document.getElementById('container-svg-evolucao');
      if (contEvol && Array.isArray(novasMetricas.evolucaoSemanal)) {
        contEvol.innerHTML = gerarSvgEvolucaoSemanal(novasMetricas.evolucaoSemanal);
      }

      var contCal = document.getElementById('container-svg-calendario');
      if (contCal && Array.isArray(novasMetricas.calendario)) {
        contCal.innerHTML = gerarSvgCalendario(novasMetricas.calendario);
      }

      var elProximo = document.getElementById('texto-proximo-passo');
      if (elProximo && novasMetricas.proximoPasso) {
        elProximo.textContent = novasMetricas.proximoPasso;
      }

      atualizarOpcoesProjetoPreservando(filtrosAtuais.projeto);
      restaurarEstadoFiltros(filtrosAtuais);
      aplicarFiltrosDiario();
    }

    conectarEventosFiltros();

    if (MODO === 'servidor') {
      setInterval(function () {
        fetch('/api/metricas')
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (dados) {
            if (dados) atualizarDomAoVivo(dados);
          })
          .catch(function () {});
      }, 10000);
    }
  })();
  `;
}

function gerarHtml(metricas, opcoes = {}) {
  const m = normalizarMetricas(metricas, opcoes);
  const geradoEm = opcoes.geradoEm !== undefined ? opcoes.geradoEm : new Date();
  const modo = opcoes.modo === 'servidor' ? 'servidor' : 'estatico';
  const dataFormatada = formatarDataHora(geradoEm);

  const jsonSeguro = serializarJsonSeguro(m);
  const temAtividades = m.resumo.totalAtividades > 0;
  const conteudoPrincipal = temAtividades ? renderizarSecoesPrincipais(m) : renderizarEstadoVazio();

  const badgeModo =
    modo === 'servidor'
      ? '<span class="badge-info badge-ao-vivo" id="indicador-modo">Ao vivo (atualiza a cada 10s)</span>'
      : '<span class="badge-info" id="indicador-modo">Modo estático</span>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scaffold Dev — Painel de estudo</title>
  <style>${gerarCssInline()}</style>
</head>
<body>
  <div class="container-pagina">
    <header class="cabecalho" id="secao-cabecalho">
      <div>
        <h1>Scaffold Dev — Painel de estudo</h1>
        <div class="metadados-perfil">
          <span class="badge-info">Nível: <strong id="perfil-nivel">${escaparHtml(m.perfil.nivel)}</strong></span>
          <span class="badge-info">Stack: <strong id="perfil-stack">${escaparHtml(m.perfil.stack || 'não definida')}</strong></span>
          <span class="badge-info" id="atualizado-em">atualizado em ${escaparHtml(dataFormatada)}</span>
        </div>
      </div>
      <div>
        ${badgeModo}
      </div>
    </header>
    <main id="conteudo-principal">
      ${conteudoPrincipal}
    </main>
  </div>
  <script type="application/json" id="dados">${jsonSeguro}</script>
  <script>${gerarScriptCliente(modo)}</script>
</body>
</html>`;
}

module.exports = {
  gerarHtml,
  escaparHtml,
  serializarJsonSeguro,
};
