---
name: config
description: Configuração do Scaffold Dev — nível (estagiario|junior|pleno), stack e lembretes (on|off). Use só quando o usuário pedir explicitamente.
argument-hint: "<nivel|stack|lembretes> <valor>"
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Configuração pedida: $ARGUMENTS

Se o pedido estiver vazio ou incompleto, rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" perfil`, mostre o resultado e explique as opções:
- `nivel estagiario|junior|pleno` — muda a profundidade das explicações e avaliações.
- `stack <texto livre>` — ex.: `stack Laravel + Vue`. Usado para dar exemplos mais próximos do seu dia a dia.
- `lembretes on|off` — liga/desliga as sugestões de estudo que aparecem quando o agente termina de mexer em arquivos (no máximo uma a cada 15 min; só em ferramentas com hooks).

Caso contrário, aplique a configuração rodando:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" config <chave> <valor>
```

e confirme o resultado em uma linha.
