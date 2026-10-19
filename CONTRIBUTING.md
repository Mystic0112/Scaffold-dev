# Contribuindo com o Scaffold Dev

Este projeto foi feito para juniores — inclusive para o seu primeiro PR open source. 💛

## Estrutura

```
.claude-plugin/   manifesto do plugin e do marketplace (Claude Code)
skills/<nome>/    skills (prompts em Markdown) — fonte única para todos os harnesses
hooks/hooks.json  hooks do plugin do Claude Code (PostToolUse e Stop)
scripts/          lógica em Node.js, sem dependências
  cli.js          perfil, registros, trilha, diário, contexto dos skills
  install.js      instalador para os outros harnesses
  hooks/          scripts chamados pelos hooks de qualquer harness
  lib/
    store.js      armazenamento local e redação de segredos
    payload.js    normaliza o JSON de hook de cada harness
    portar.js     converte um skill para o padrão Agent Skills
    harnesses.js  onde cada harness lê skills e como configurar os hooks dele
data/<idioma>/    conteúdo da trilha
docs/             planos de funcionalidades futuras
tests/            testes com node:test
```

### Adicionando um harness novo

1. Uma entrada em `scripts/lib/harnesses.js`: pasta de skills e, se houver, a config de hooks. Calcule caminhos dentro de funções, nunca no carregamento do módulo.
2. Se o JSON do hook dele tiver um formato novo, ensine `scripts/lib/payload.js` e adicione o payload de exemplo em `tests/payload.test.js`.
3. Uma linha na tabela de instalação do README, com o link da documentação oficial no PR.

## Rodando localmente

```bash
npm test                              # testes
claude plugin validate .              # valida os manifestos
claude --plugin-dir .                 # abre o Claude Code com o plugin local
```

Use `SCAFFOLD_DEV_HOME=/tmp/sd` para não misturar com seus dados reais.

## Boas primeiras contribuições

- Melhorar ou adicionar conceitos em `data/pt-BR/trilha.json`
- Traduzir a trilha para `data/en/` ou `data/es/`
- Melhorar os prompts dos skills (`skills/*/SKILL.md`) — conte no PR o antes e o depois de uma conversa real
- Novos padrões de segredo em `scripts/lib/store.js` (com teste!)

## Regras

- Zero dependências npm nos scripts — o plugin precisa rodar em qualquer máquina com Node 20+.
- Hooks nunca podem quebrar ou travar o trabalho do agente: sempre saem com código 0 e são rápidos.
- Nunca grave conteúdo de código do usuário nos logs.
- Todo PR roda os testes no Windows, macOS e Linux.
