# Plano: Painel de métricas de estudo

> **Para o agente que vai implementar (Antigravity / qualquer agente):** leia este documento inteiro antes de começar. Ele é autocontido. Implemente as fases em ordem, rode `npm test` ao fim de cada uma e não altere o comportamento existente dos outros comandos. Em caso de dúvida entre duas opções, escolha a mais simples e anote a decisão no PR.

## 1. Contexto do projeto

O **Scaffold Dev** é um plugin open source para agentes de código (Claude Code e, em andamento, outros harnesses como Codex, Gemini CLI, Cursor e OpenCode) que ajuda devs juniores a chegar à régua de pleno. O dev pratica com o código real do próprio trabalho:

- **prever** — escreve como resolveria a tarefa antes do agente implementar; depois compara.
- **revisar** — faz code review do que o agente mudou; o mentor avalia a revisão.
- **explicar** — recebe uma explicação e explica de volta (técnica de Feynman).
- **estudo** — gera pacotes Markdown para NotebookLM / SurfSense.

Cada atividade recebe uma **nota de 0 a 10** e é associada a **áreas** de uma trilha júnior → pleno. Hoje o progresso só aparece em texto (`node scripts/cli.js trilha`, com barras ASCII). **O objetivo é uma tela para acompanhar as métricas de estudo.**

### Regras do repositório (obrigatórias)

- Node.js **20+**, **zero dependências npm** (nem em dev). Só módulos nativos (`fs`, `path`, `http`, `child_process`, `node:test`).
- Precisa funcionar igual em **Windows, macOS e Linux**, sem WSL.
- Código, nomes de funções/variáveis e textos em **português do Brasil**, no estilo dos arquivos existentes (`'use strict'`, CommonJS, funções pequenas, comentários curtos).
- Dados são **locais e privados**. Nada sai da máquina. Nenhum CDN, fonte externa, analytics ou request de rede no HTML.
- Testes com `node:test` em `tests/*.test.js`; rodar com `npm test`. CI roda em Ubuntu, Windows e macOS com Node 20 e 22.

### Arquivos relevantes

```
scripts/cli.js            CLI usada pelos skills (comandos: contexto, perfil, config, mudancas, registrar, trilha, diario, export-dir)
scripts/lib/store.js      onde ficam os dados: dataDir(), exportDir(), lerPerfil(), lerLinhas(), redigir()
data/pt-BR/trilha.json    as 11 áreas da trilha (id, nome, "espera-se", conceitos)
skills/<nome>/SKILL.md    skills (prompts) — formato Agent Skills
tests/helpers.js          dirTemporario(): isola dados e cwd em cada teste
```

## 2. Dados disponíveis (somente leitura para o painel)

Diretório de dados: `store.dataDir()` → `$SCAFFOLD_DEV_HOME` › `$CLAUDE_PLUGIN_DATA` › `~/.scaffold-dev`.

**`perfil.json`**

```json
{
  "versao": 1,
  "idioma": "pt-BR",
  "nivel": "junior",
  "stack": "Laravel + Vue",
  "lembretes": true,
  "criadoEm": "2026-10-18T23:30:00.000Z",
  "ultimoLembrete": 1760830000000,
  "estatisticas": {
    "previsao":   { "total": 3, "somaNotas": 19 },
    "revisao":    { "total": 5, "somaNotas": 31 },
    "explicacao": { "total": 2, "somaNotas": 15 }
  },
  "areas":     { "testes": { "total": 4, "somaNotas": 26 }, "seguranca": { "total": 2, "somaNotas": 9 } },
  "conceitos": { "N+1": 3, "XSS": 1 }
}
```

**`diario.jsonl`**: uma atividade por linha. É a fonte principal para métricas no tempo.

```json
{"ts":"2026-10-18T23:40:12.000Z","projeto":"api-pedidos","tipo":"revisao","nota":6,"areas":["seguranca","testes"],"conceitos":["XSS","validação"],"resumo":"revisei endpoint de cadastro"}
```

- `tipo` ∈ `previsao | revisao | explicacao`
- `nota` é um número de 0 a 10
- `areas` são ids de `data/pt-BR/trilha.json`
- `resumo` é **texto livre do usuário**: trate como não confiável e sempre escape (veja Segurança)

**`mudancas.jsonl`** e **`comandos.jsonl`**: logs dos hooks, mostrando arquivos editados pelo agente e comandos redigidos. **Não use no painel** nesta versão.

Use `store.lerPerfil()` e `store.lerLinhas('diario.jsonl')`. Eles já tratam arquivo inexistente ou corrompido.

## 3. O que construir

### Fase 1 — Métricas (lógica pura, sem HTML)

Crie `scripts/lib/metricas.js` exportando `calcularMetricas({ perfil, diario, trilha, agora = new Date() })`. A função é **pura**: sem I/O e com a data injetada para os testes. Ela retorna:

| Campo | Definição |
|---|---|
| `resumo.totalAtividades` | `diario.length` |
| `resumo.mediaGeral` | média das notas do diário (`null` se vazio) |
| `resumo.ultimos7Dias` | atividades com `ts` nos últimos 7 dias |
| `resumo.sequenciaAtual` | dias consecutivos com ≥1 atividade, terminando hoje ou ontem (fuso local) |
| `resumo.melhorSequencia` | maior sequência histórica |
| `porTipo` | `{ previsao: {total, media}, revisao: {...}, explicacao: {...} }` |
| `areas` | para **todas** as 11 áreas da trilha: `{ id, nome, total, media \| null }`, na ordem do `trilha.json` |
| `evolucaoSemanal` | por semana ISO (últimas 12): `{ semana: "2026-W42", total, media }`, incluindo semanas vazias |
| `calendario` | últimos 182 dias: `{ data: "AAAA-MM-DD", total }` (para o heatmap) |
| `conceitos` | top 15 por frequência no diário: `{ nome, vezes }` |
| `lacunas` | áreas com `total === 0` ou com `media < 6` e `total >= 2` |
| `proximoPasso` | texto curto por regra: (1) a área com menor média entre as que têm `total >= 2`; senão (2) a primeira área nunca praticada; senão (3) "continue praticando". Sem chamar LLM. |
| `atividadesRecentes` | últimas 50 entradas do diário, mais recentes primeiro |

Regras:
- **Nota desconhecida não é zero.** Área sem registro tem `media: null`.
- Datas: agrupe por dia no **fuso local** da máquina (o usuário pensa no dia dele, não em UTC).
- Ignore entradas do diário sem `ts` válido ou com `nota` fora de 0–10.

**Testes (`tests/metricas.test.js`):** diário vazio; sequência atual e melhor sequência (com buraco no meio); semanas vazias preenchidas; área nunca praticada aparece com `media: null` e entra em `lacunas`; entrada inválida ignorada; `proximoPasso` em cada um dos 3 casos.

### Fase 2 — Painel HTML estático

Novo comando: `node scripts/cli.js painel [--saida <arquivo>] [--abrir]`

- Gera **um único arquivo HTML autocontido**: CSS e JS inline, gráficos em **SVG feito à mão**, sem bibliotecas.
- Saída padrão: `<exportDir>/painel.html`. Use `store.exportDir()`.
- Os dados vão embutidos em `<script type="application/json" id="dados">…</script>`; o JS da página lê e renderiza.
- `--abrir` abre no navegador padrão: `start "" <arquivo>` no Windows (via `cmd /c`), `open` no macOS e `xdg-open` no Linux. Se falhar, só imprime o caminho.
- A CLI imprime o caminho do arquivo gerado.

Organize em `scripts/lib/painel-html.js` com `gerarHtml(metricas, { geradoEm, modo: 'estatico' | 'servidor' })` → string.

**Seções da tela, de cima para baixo:**

1. **Cabeçalho**: "Scaffold Dev — Painel de estudo", nível e stack do perfil, "atualizado em …".
2. **Cartões (KPIs)**: total de atividades · média geral · sequência atual (🔥 N dias) · últimos 7 dias.
3. **Radar da trilha**: polígono SVG com as 11 áreas (0–10). Áreas sem dados aparecem como eixo tracejado/cinza, nunca como zero. Ao lado, uma tabela acessível com os mesmos números (área, média, nº de registros).
4. **Evolução semanal**: gráfico de linha da média por semana com barras de volume ao fundo. Semanas sem atividade aparecem como lacuna na linha, não como zero.
5. **Calendário de atividade**: heatmap no estilo GitHub dos últimos 6 meses, com 5 tons e tooltip `title` "3 atividades em 12/10".
6. **Por tipo**: três barras horizontais (previsão, revisão, explicação) com total e média.
7. **Conceitos mais estudados**: lista com barras proporcionais.
8. **Lacunas e próximo passo**: destaque com `proximoPasso` e a lista de `lacunas`.
9. **Diário**: tabela das atividades recentes com filtros no cliente por tipo, área e projeto, e busca por texto no resumo.

**Estado vazio:** se não houver atividades, mostre uma tela amigável explicando como começar (praticar `prever`, `revisar` e `explicar`) em vez de gráficos vazios.

**Visual:**
- Tema claro e escuro via `prefers-color-scheme`, com cores em variáveis CSS no `:root`.
- Responsivo: no celular (≤ 640px) as seções ficam em coluna única, sem scroll horizontal.
- Fonte do sistema (`system-ui`). Nada externo.
- Acessível: contraste AA, `aria-label`/`<title>` nos SVGs, e tabelas equivalentes para os gráficos.

**Testes (`tests/painel.test.js`):**
- `gerarHtml` com dados de exemplo contém as seções e os números esperados.
- Com diário vazio, mostra o estado vazio.
- **Teste de segurança:** um `resumo` igual a `</script><img src=x onerror=alert(1)>` não pode quebrar o HTML nem aparecer sem escape.
- O comando `painel --saida <tmp>` cria o arquivo e imprime o caminho.
- O HTML não contém `http://` nem `https://` em `src=` ou `href=` de recursos (garante que é offline).

### Fase 3 — Modo ao vivo (tela aberta enquanto o agente trabalha)

`node scripts/cli.js painel --servir [--porta 4173]`

- Servidor `http` nativo escutando **apenas em `127.0.0.1`**. Nunca em `0.0.0.0`.
- `GET /` devolve o HTML (`modo: 'servidor'`); `GET /api/metricas` devolve o JSON de `calcularMetricas` recalculado a cada request; qualquer outra rota responde 404.
- No modo servidor, a página faz `fetch('/api/metricas')` a cada 10 s e re-renderiza sem recarregar a página nem perder os filtros do diário.
- Se a porta estiver ocupada, tente as próximas 10 e imprima a URL final.
- `Ctrl+C` encerra de forma limpa.
- Headers: `Content-Type` correto, `Cache-Control: no-store` e `Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:`.

**Teste:** sobe o servidor em porta 0 (aleatória), faz GET em `/` e em `/api/metricas`, confere o status e o JSON, e encerra.

### Fase 4 — Skill e documentação

1. Crie `skills/painel/SKILL.md` no mesmo formato dos outros. Frontmatter com `name: painel`, uma `description` terminando em "Use só quando o usuário pedir explicitamente." e `disable-model-invocation: true`. O corpo instrui o agente a rodar `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" painel --abrir`, mostrar o caminho e mencionar o `--servir` para acompanhar ao vivo.
2. O teste `tests/portar.test.js` já verifica que **todo** skill é portável. Ele precisa continuar passando.
3. **README.md**: adicione uma seção "Painel de métricas" com como abrir (estático e ao vivo), uma tabela do que cada seção mostra, e marque o item "Painel visual de progresso" do Roadmap como feito.
4. Atualize o cabeçalho de uso no topo de `scripts/cli.js` com o comando `painel`.

## 4. Segurança e privacidade

- **Escape tudo** que vem do diário (`resumo`, `projeto`, `conceitos`) ao inserir no DOM. Use `textContent`, nunca `innerHTML` com dados.
- Ao embutir JSON no HTML, escape `<` como `<` para impedir que `</script>` feche a tag.
- Servidor só em `127.0.0.1`, sem CORS e sem rotas de escrita.
- Não exibir `mudancas.jsonl` nem `comandos.jsonl` (podem conter caminhos internos da empresa).

## 5. Critérios de aceite

- [ ] `npm test` passa, com todos os testes antigos e novos.
- [ ] `node scripts/cli.js painel --abrir` abre a tela no Windows (e no Linux/macOS, pelo CI e pela leitura do código).
- [ ] Com o diário vazio, aparece o estado vazio amigável e nenhum erro no console.
- [ ] Com dados de exemplo (crie um script `scripts/dev/dados-exemplo.js` que gera ~60 atividades em 3 meses num diretório `SCAFFOLD_DEV_HOME` temporário), todas as seções renderizam, nos temas claro e escuro, em 1280px e em 375px.
- [ ] O modo `--servir` atualiza a tela sozinho quando uma atividade nova é registrada com `node scripts/cli.js registrar --tipo revisao --nota 7 --areas testes`.
- [ ] O HTML gerado não faz nenhuma requisição externa.
- [ ] Zero dependências adicionadas ao `package.json`.

## 6. Fora de escopo (não fazer agora)

- Gráficos com bibliotecas (Chart.js, D3 etc.).
- Login, nuvem, sincronização entre máquinas.
- Edição de dados pelo painel.
- Revisão espaçada / flashcards (é outro item do roadmap).

## 7. Como validar manualmente

```bash
npm test
SCAFFOLD_DEV_HOME=/tmp/sd node scripts/dev/dados-exemplo.js
SCAFFOLD_DEV_HOME=/tmp/sd node scripts/cli.js painel --abrir
SCAFFOLD_DEV_HOME=/tmp/sd node scripts/cli.js painel --servir
```

No Windows (PowerShell): `$env:SCAFFOLD_DEV_HOME="$env:TEMP\sd"; node scripts/cli.js painel --abrir`.
