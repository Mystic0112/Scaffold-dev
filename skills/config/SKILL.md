---
description: Configura o Scaffold Dev — nível (estagiario|junior|pleno), stack, lembretes (on|off).
argument-hint: "<nivel|stack|lembretes> <valor>"
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Configuração pedida: $ARGUMENTS

Se o pedido estiver vazio ou incompleto, mostre o perfil atual e explique as opções:
- `nivel estagiario|junior|pleno` — muda a profundidade das explicações e avaliações.
- `stack <texto livre>` — ex.: `stack Laravel + Vue`. Usado para dar exemplos mais próximos do seu dia a dia.
- `lembretes on|off` — liga/desliga as sugestões de estudo que aparecem quando o Claude termina de mexer em arquivos (no máximo uma a cada 15 min).

Perfil atual:
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" perfil`

Caso contrário, aplique a configuração rodando:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" config $ARGUMENTS
```

e confirme o resultado em uma linha.
