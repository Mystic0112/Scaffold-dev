# 🥋 Scaffold Dev

**Aprenda com o código que o Claude escreve no seu projeto, em vez de só aceitar o que ele gera.**

Plugin open source do [Claude Code](https://code.claude.com) para estagiários e devs juniores que querem chegar à régua de pleno usando o próprio trabalho do dia a dia como material de estudo.

## Por quê

A régua subiu. O que antes se esperava de um pleno hoje aparece em vaga de júnior. Ao mesmo tempo, quem trabalha com agentes de IA corre um risco novo: entregar muito código e entender pouco dele.

O Scaffold Dev transforma o tempo em que o agente trabalha em **prática ativa**: prever, revisar e explicar. Ler explicações dá a sensação de aprender; praticar é o que muda a régua.

## O que ele faz

| Comando | O que acontece |
|---|---|
| `/scaffold-dev:prever <tarefa>` | Você escreve como resolveria (abordagem, arquivos, riscos, teste). O Claude implementa e compara as duas soluções, com nota. |
| `/scaffold-dev:revisar` | Você faz code review do que o Claude mudou. O mentor mostra o que você encontrou, o que deixou passar e por que importa. |
| `/scaffold-dev:explicar [foco]` | Explicação adaptada ao seu nível, seguida de um desafio Feynman: você explica de volta e recebe feedback. |
| `/scaffold-dev:estudo [tema]` | Gera um **pacote de estudo em Markdown** para importar no **NotebookLM** ou no **SurfSense**: resumo em áudio, flashcards, quiz e mapa mental. |
| `/scaffold-dev:progresso` | Radar da trilha júnior → pleno, diário de aprendizado e o próximo passo sugerido. |
| `/scaffold-dev:config` | Define nível (`estagiario`, `junior`, `pleno`), stack e lembretes. |

Quando o Claude termina de mexer em arquivos, o plugin sugere uma atividade de estudo (no máximo uma a cada 15 minutos; desligue com `/scaffold-dev:config lembretes off`).

### Trilha júnior → pleno

Cada atividade é registrada em 11 áreas: código limpo, testes, debugging, banco de dados, APIs/HTTP, segurança, arquitetura, performance, concorrência, produção/observabilidade e colaboração. Veja o conteúdo em [`data/pt-BR/trilha.json`](data/pt-BR/trilha.json).

```
Testes                      ██████░░░░  6.0  (3x)
Segurança                   ████░░░░░░  4.0  (2x)
Banco de dados e SQL        ░░░░░░░░░░  —    (0x)
```

## Instalação

Requisitos: Claude Code e Node.js 20+. Funciona em Windows, macOS e Linux, sem WSL, jq ou dependências npm.

No Claude Code:

```
/plugin marketplace add Mystic0112/Scaffold-dev
/plugin install scaffold-dev@scaffold-dev
```

Depois, configure o seu nível:

```
/scaffold-dev:config nivel junior
```

## NotebookLM e SurfSense

O `/scaffold-dev:estudo` gera um arquivo `.md` em `~/scaffold-dev-estudos/` com contexto, conceitos, trade-offs, perguntas de entrevista, flashcards e exercícios.

- **[NotebookLM](https://notebooklm.google.com)** — gratuito com conta Google. Crie um notebook, adicione o `.md` como fonte e gere um resumo em áudio para ouvir enquanto o agente trabalha.
- **[SurfSense](https://github.com/MODSetter/SurfSense)** — alternativa open source que roda **local**, sem conta e com o LLM que você escolher. Adicione a pasta inteira como fonte.

> ⚠️ **Código da empresa:** o NotebookLM envia o conteúdo para o Google. Por padrão, o pacote é **anonimizado**: sem código do projeto, com exemplos genéricos equivalentes. Use `/scaffold-dev:estudo --local` para incluir trechos reais, de preferência só com o SurfSense, e siga a política da sua empresa.

## Privacidade

- Tudo fica na sua máquina, em `~/.claude/plugins/data/…` (ou `SCAFFOLD_DEV_HOME`). Sem telemetria.
- Os hooks gravam **apenas caminhos de arquivos** alterados e comandos **truncados e com segredos redigidos** (tokens, senhas, chaves). Nunca o conteúdo do código.
- Os logs guardam as últimas 1000 entradas.
- Para apagar tudo, remova a pasta de dados. Desinstalar o plugin também a remove.

| Variável | Padrão | Para quê |
|---|---|---|
| `SCAFFOLD_DEV_HOME` | `$CLAUDE_PLUGIN_DATA` ou `~/.scaffold-dev` | Onde ficam perfil e logs |
| `SCAFFOLD_DEV_EXPORT_DIR` | `~/scaffold-dev-estudos` | Onde os pacotes de estudo são salvos |

## Roadmap

- [ ] Revisão espaçada: flashcards que voltam no dia certo
- [ ] Painel visual de progresso
- [ ] Integração direta com a API do SurfSense / NotebookLM Enterprise
- [ ] Trilhas por stack (Laravel, Node/TS, Python…)
- [ ] Inglês e espanhol (a estrutura `data/<idioma>/` já está pronta)

## Contribuindo

Contribuições são muito bem-vindas, principalmente de quem está começando. Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Inspiração

Inspirado no [code-sensei](https://github.com/DojoCodingLabs/code-sensei) (MIT), que ensina programação a quem constrói com IA. O Scaffold Dev foca em devs que já programam e querem subir de nível, com prática ativa, conteúdo em português e suporte nativo ao Windows.

## Licença

[MIT](LICENSE)
