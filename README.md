# 🥋 Scaffold Dev

**Aprenda com o código que o agente escreve no seu projeto, em vez de só aceitar o que ele gera.**

Plugin open source para agentes de código (Claude Code, Codex, Copilot, Cursor, Gemini CLI, Antigravity, Windsurf, Kiro, OpenCode, Amp, Cline, Goose e Roo) para estagiários e devs juniores que querem chegar à régua de pleno usando o próprio trabalho do dia a dia como material de estudo.

## Por quê

A régua subiu. O que antes se esperava de um pleno hoje aparece em vaga de júnior. Ao mesmo tempo, quem trabalha com agentes de IA corre um risco novo: entregar muito código e entender pouco dele.

O Scaffold Dev transforma o tempo em que o agente trabalha em **prática ativa**: prever, revisar e explicar. Ler explicações dá a sensação de aprender; praticar é o que muda a régua.

## O que ele faz

| Skill | O que acontece |
|---|---|
| **prever** `<tarefa>` | Você escreve como resolveria (abordagem, arquivos, riscos, teste). O agente implementa e compara as duas soluções, com nota. |
| **revisar** | Você faz code review do que o agente mudou. O mentor mostra o que você encontrou, o que deixou passar e por que importa. |
| **explicar** `[foco]` | Explicação adaptada ao seu nível, seguida de um desafio Feynman: você explica de volta e recebe feedback. |
| **estudo** `[tema]` | Gera um **pacote de estudo em Markdown** para importar no **NotebookLM** ou no **SurfSense**: resumo em áudio, flashcards, quiz e mapa mental. |
| **progresso** | Radar da trilha júnior → pleno, diário de aprendizado e o próximo passo sugerido. |
| **painel** | Gera e abre o painel visual de métricas em HTML (estático ou ao vivo no navegador). |
| **config** | Define nível (`estagiario`, `junior`, `pleno`), stack e lembretes. |

No Claude Code os skills se chamam `/scaffold-dev:prever`, `/scaffold-dev:revisar` etc. Nas outras ferramentas, `scaffold-dev-prever`, `scaffold-dev-revisar` etc. (veja a tabela de instalação para a sintaxe de cada uma).

Nas ferramentas com hooks, o plugin registra quais arquivos o agente alterou e, quando ele termina, sugere uma atividade de estudo (no máximo uma a cada 15 minutos; desligue com o skill `config`: `lembretes off`). Sem hooks, o histórico vem do `git status`.

### Trilha júnior → pleno

Cada atividade é registrada em 11 áreas: código limpo, testes, debugging, banco de dados, APIs/HTTP, segurança, arquitetura, performance, concorrência, produção/observabilidade e colaboração. Veja o conteúdo em [`data/pt-BR/trilha.json`](data/pt-BR/trilha.json).

```
Testes                      ██████░░░░  6.0  (3x)
Segurança                   ████░░░░░░  4.0  (2x)
Banco de dados e SQL        ░░░░░░░░░░  —    (0x)
```

O progresso fica num perfil único em `~/.scaffold-dev`, compartilhado por todas as ferramentas: estudou no Cursor de manhã e no Claude Code à tarde, conta tudo junto.

## Instalação

Requisitos: Node.js 20+. Funciona em Windows, macOS e Linux, sem WSL, jq ou dependências npm.

### Claude Code

```
/plugin marketplace add Mystic0112/Scaffold-dev
/plugin install scaffold-dev@scaffold-dev
```

### Outras ferramentas

```bash
git clone https://github.com/Mystic0112/Scaffold-dev.git ~/scaffold-dev
node ~/scaffold-dev/scripts/install.js todos
```

O `todos` instala em todas as ferramentas detectadas na máquina. Para escolher, passe os nomes: `node scripts/install.js codex cursor`. Sem argumentos, ele lista o que foi detectado.

| Ferramenta | `id` | Skills em | Como chamar | Registro de mudanças | Lembretes |
|---|---|---|---|---|---|
| Claude Code | `claude` | plugin nativo | `/scaffold-dev:revisar` | hooks | ✅ |
| OpenAI Codex | `codex` | `~/.agents/skills` | `$scaffold-dev-revisar` | hooks¹ | ✅ |
| GitHub Copilot (CLI e VS Code) | `copilot` | `~/.agents/skills` | `/scaffold-dev-revisar` | hooks | ✅ |
| Gemini CLI | `gemini` | `~/.agents/skills` | peça "use o skill scaffold-dev-revisar" | hooks | ✅ |
| Antigravity CLI | `antigravity` | `~/.gemini/antigravity-cli/skills` | peça pelo nome do skill | git status | — |
| Cursor | `cursor` | `~/.agents/skills` | `/scaffold-dev-revisar` | hooks | —² |
| Windsurf / Devin Desktop | `windsurf` | `~/.agents/skills` | `@scaffold-dev-revisar` | hooks | — |
| Kiro | `kiro` | `~/.kiro/skills` | `/scaffold-dev-revisar` | hooks³ | — |
| OpenCode | `opencode` | `~/.agents/skills` | peça pelo nome do skill | plugin JS | ✅ |
| Amp | `amp` | `~/.agents/skills` | peça pelo nome do skill | plugin TS³ | ✅ |
| Cline | `cline` | `~/.cline/skills` | `/scaffold-dev-revisar` | git status | — |
| Goose | `goose` | `~/.agents/skills` | `/skills scaffold-dev-revisar` | git status | — |
| Roo Code | `roo` | `~/.agents/skills` | automático | git status | — |

¹ No Codex, aprove os hooks novos com `/hooks`. ² O Cursor não permite que hooks mostrem mensagens ao usuário. ³ Segue a documentação oficial, mas ainda não foi testado na ferramenta real. Se algo não funcionar, abra uma issue com o payload do hook.

**Segurança do instalador:** ele nunca sobrescreve configurações suas. Faz merge, guarda um backup (`*.antes-scaffold-dev.bak`) antes da primeira alteração, marca as próprias entradas e recusa mexer em JSON inválido. Para remover tudo: `node scripts/install.js todos --desinstalar`. Se mover a pasta do Scaffold Dev, rode o instalador de novo.

## NotebookLM e SurfSense

O skill **estudo** gera um arquivo `.md` em `~/scaffold-dev-estudos/` com contexto, conceitos, trade-offs, perguntas de entrevista, flashcards e exercícios.

- **[NotebookLM](https://notebooklm.google.com)** — gratuito com conta Google. Crie um notebook, adicione o `.md` como fonte e gere um resumo em áudio para ouvir enquanto o agente trabalha.
- **[SurfSense](https://github.com/MODSetter/SurfSense)** — alternativa open source que roda **local**, sem conta e com o LLM que você escolher. Adicione a pasta inteira como fonte.

> ⚠️ **Código da empresa:** o NotebookLM envia o conteúdo para o Google. Por padrão, o pacote é **anonimizado**: sem código do projeto, com exemplos genéricos equivalentes. Peça o estudo com `--local` para incluir trechos reais, de preferência só com o SurfSense, e siga a política da sua empresa.

## Privacidade

- Tudo fica na sua máquina, em `~/.scaffold-dev` (ou `SCAFFOLD_DEV_HOME`). Sem telemetria.
- Os hooks gravam **apenas caminhos de arquivos** alterados e comandos **truncados e com segredos redigidos** (tokens, senhas, chaves). Nunca o conteúdo do código.
- Os logs guardam as últimas 1000 entradas.
- Para apagar tudo, remova `~/.scaffold-dev`.

| Variável | Padrão | Para quê |
|---|---|---|
| `SCAFFOLD_DEV_HOME` | `~/.scaffold-dev` | Onde ficam perfil e logs |
| `SCAFFOLD_DEV_EXPORT_DIR` | `~/scaffold-dev-estudos` | Onde os pacotes de estudo são salvos |

## Painel de métricas

Além do resumo em texto (`progresso`), você pode abrir um painel visual em HTML autocontido (100% offline, sem dependências externas, com tema claro e escuro automático):

```bash
# Gera o arquivo ~/scaffold-dev-estudos/painel.html e abre no navegador
node scripts/cli.js painel --abrir

# Ou sobe um servidor local (127.0.0.1:4173) que atualiza a tela a cada 10s
node scripts/cli.js painel --servir
```

| Seção | O que mostra |
|---|---|
| **Indicadores (KPIs)** | Total de atividades, média geral, sequência atual de dias seguidos e atividades nos últimos 7 dias. |
| **Radar da trilha** | Gráfico radar SVG nas 11 áreas (0–10), destacando áreas ainda sem dados como eixos tracejados, acompanhado de tabela acessível. |
| **Evolução semanal** | Volume de atividades em barras e média de notas em linha nas últimas 12 semanas ISO. |
| **Calendário de atividade** | Heatmap dos últimos 6 meses (182 dias) no fuso local. |
| **Por tipo e conceitos** | Distribuição entre `previsao`, `revisao` e `explicacao`, mais os 15 conceitos mais praticados. |
| **Lacunas e próximo passo** | Sugestão objetiva do que praticar a seguir e lista de áreas sem prática ou com média abaixo de 6. |
| **Diário** | Tabela das últimas 50 atividades com filtros instantâneos por tipo, área, projeto e busca no resumo. |

## Roadmap

- [x] Painel visual de métricas de estudo — plano detalhado em [`docs/plano-painel.md`](docs/plano-painel.md)
- [ ] Revisão espaçada: flashcards que voltam no dia certo
- [ ] Integração direta com a API do SurfSense / NotebookLM Enterprise
- [ ] Trilhas por stack (Laravel, Node/TS, Python…)
- [ ] Inglês e espanhol (a estrutura `data/<idioma>/` já está pronta)

## Contribuindo

Contribuições são muito bem-vindas, principalmente de quem está começando. Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Inspiração

Inspirado no [code-sensei](https://github.com/DojoCodingLabs/code-sensei) (MIT), que ensina programação a quem constrói com IA. O Scaffold Dev foca em devs que já programam e querem subir de nível, com prática ativa, conteúdo em português e suporte a vários agentes e sistemas operacionais.

## Licença

[MIT](LICENSE)
