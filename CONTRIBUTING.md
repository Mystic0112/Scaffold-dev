# Contribuindo com o Scaffold Dev

Este projeto foi feito para juniores — inclusive para o seu primeiro PR open source. 💛

## Estrutura

```
.claude-plugin/   manifesto do plugin e do marketplace
skills/<nome>/    comandos /scaffold-dev:<nome> (prompts em Markdown)
hooks/hooks.json  hooks do Claude Code (PostToolUse e Stop)
scripts/          lógica em Node.js, sem dependências
  cli.js          perfil, registros, trilha, diário
  hooks/          scripts chamados pelos hooks
  lib/            armazenamento local e redação de segredos
data/<idioma>/    conteúdo da trilha
tests/            testes com node:test
```

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
