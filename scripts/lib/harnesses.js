'use strict';

// Onde cada harness lê skills e como configurar os hooks dele.
// Fontes: documentação oficial de cada ferramenta, pesquisada em out/2026.
// Itens marcados com "não verificado" seguem a doc, mas ainda não foram testados na ferramenta real.

const os = require('os');
const path = require('path');

const MARCA = '--origem scaffold-dev'; // identifica nossas entradas nas configs dos outros

function casa(...partes) {
  return path.join(os.homedir(), ...partes);
}

function comandos(raiz) {
  const r = raiz.replace(/\\/g, '/');
  return {
    post: `node "${r}/scripts/hooks/post-tool.js" ${MARCA}`,
    stop: (formato, harness) => `node "${r}/scripts/hooks/stop.js" --formato ${formato} --harness ${harness} ${MARCA}`,
    raiz: r,
  };
}

// skills: 'agents' = ~/.agents/skills (pasta comum lida pela maioria); ou função que devolve a pasta própria.
// Tudo que depende do HOME é calculado na hora do uso, nunca no carregamento do módulo.
// hooks(raiz) devolve { tipo: 'json-merge' | 'arquivo', arquivo, conteudo, aviso? } ou null.
const HARNESSES = {
  claude: {
    nome: 'Claude Code',
    detectar: () => casa('.claude'),
    skills: null, // usa o plugin nativo (.claude-plugin), com hooks incluídos
    hooks: null,
    aviso: 'No Claude Code use o plugin nativo: /plugin marketplace add Mystic0112/Scaffold-dev e /plugin install scaffold-dev@scaffold-dev',
  },
  codex: {
    nome: 'OpenAI Codex',
    detectar: () => casa('.codex'),
    skills: 'agents',
    hooks: (raiz) => {
      const c = comandos(raiz);
      return {
        tipo: 'json-merge',
        arquivo: casa('.codex', 'hooks.json'),
        conteudo: {
          hooks: {
            PostToolUse: [{ matcher: 'Bash|apply_patch|Edit|Write', hooks: [{ type: 'command', command: c.post, timeout: 10 }] }],
            Stop: [{ hooks: [{ type: 'command', command: c.stop('json', 'codex'), timeout: 10 }] }],
          },
        },
        aviso: 'No Codex, aprove os hooks novos com /hooks (hooks fora de config gerenciada precisam de aprovação).',
      };
    },
  },
  copilot: {
    nome: 'GitHub Copilot (CLI e VS Code)',
    detectar: () => casa('.copilot'),
    skills: 'agents',
    hooks: (raiz) => {
      const c = comandos(raiz);
      const cmd = (s) => ({ type: 'command', bash: s, powershell: s, timeoutSec: 10 });
      return {
        tipo: 'arquivo',
        arquivo: casa('.copilot', 'hooks', 'scaffold-dev.json'),
        conteudo: {
          version: 1,
          hooks: {
            postToolUse: [{ ...cmd(c.post), matcher: 'edit|create|bash|powershell' }],
            agentStop: [cmd(c.stop('copilot', 'copilot'))],
          },
        },
      };
    },
  },
  gemini: {
    nome: 'Gemini CLI',
    detectar: () => casa('.gemini'),
    skills: 'agents',
    hooks: (raiz) => {
      const c = comandos(raiz);
      return {
        tipo: 'json-merge',
        arquivo: casa('.gemini', 'settings.json'),
        conteudo: {
          hooks: {
            AfterTool: [{ matcher: '*', hooks: [{ type: 'command', name: 'scaffold-dev', command: c.post, timeout: 10000 }] }],
            AfterAgent: [{ hooks: [{ type: 'command', name: 'scaffold-dev', command: c.stop('json', 'gemini'), timeout: 10000 }] }],
          },
        },
      };
    },
  },
  antigravity: {
    nome: 'Antigravity CLI (agy)',
    detectar: () => casa('.gemini', 'antigravity-cli'),
    skills: () => casa('.gemini', 'antigravity-cli', 'skills'),
    hooks: null, // formato de hooks ainda não documentado; o histórico vem do git status
  },
  cursor: {
    nome: 'Cursor',
    detectar: () => casa('.cursor'),
    skills: 'agents',
    hooks: (raiz) => {
      const c = comandos(raiz);
      return {
        tipo: 'json-merge',
        arquivo: casa('.cursor', 'hooks.json'),
        conteudo: {
          version: 1,
          hooks: {
            afterFileEdit: [{ command: c.post, timeout: 10 }],
            afterShellExecution: [{ command: c.post, timeout: 10 }],
          },
        },
        aviso: 'O Cursor não tem como hooks mostrarem mensagem ao usuário; os lembretes de estudo ficam desligados lá.',
      };
    },
  },
  windsurf: {
    nome: 'Windsurf / Devin Desktop',
    detectar: () => casa('.codeium', 'windsurf'),
    skills: 'agents',
    hooks: (raiz) => {
      const c = comandos(raiz);
      const h = { command: c.post, powershell: c.post, show_output: false };
      return {
        tipo: 'json-merge',
        arquivo: casa('.codeium', 'windsurf', 'hooks.json'),
        conteudo: { hooks: { post_write_code: [h], post_run_command: [h] } },
      };
    },
  },
  kiro: {
    nome: 'Kiro',
    detectar: () => casa('.kiro'),
    skills: () => casa('.kiro', 'skills'),
    hooks: (raiz) => {
      const c = comandos(raiz);
      const h = (matcher) => ({
        name: `scaffold-dev-${matcher}`,
        trigger: 'PostToolUse',
        matcher,
        action: { type: 'command', command: c.post },
        timeout: 10,
      });
      return {
        tipo: 'arquivo',
        arquivo: casa('.kiro', 'hooks', 'scaffold-dev.json'),
        conteudo: { version: 'v1', hooks: [h('write'), h('shell')] },
        aviso: 'Kiro: hooks globais (~/.kiro/hooks) são documentados para o Kiro CLI; na IDE não verificado.',
      };
    },
  },
  opencode: {
    nome: 'OpenCode',
    detectar: () => casa('.config', 'opencode'),
    skills: 'agents',
    hooks: (raiz) => ({
      tipo: 'arquivo',
      arquivo: casa('.config', 'opencode', 'plugins', 'scaffold-dev.js'),
      conteudo: pluginOpenCode(comandos(raiz).raiz),
    }),
  },
  amp: {
    nome: 'Amp',
    detectar: () => casa('.config', 'amp'),
    skills: 'agents',
    hooks: (raiz) => ({
      tipo: 'arquivo',
      arquivo: casa('.config', 'amp', 'plugins', 'scaffold-dev.ts'),
      conteudo: pluginAmp(comandos(raiz).raiz),
      aviso: 'Amp: plugin experimental (API de plugins do Amp, não verificado na ferramenta real). Recarregue com "plugins: reload".',
    }),
  },
  cline: {
    nome: 'Cline',
    detectar: () => casa('.cline'),
    skills: () => casa('.cline', 'skills'),
    hooks: null, // API de plugins sem payload documentado; o histórico vem do git status
  },
  goose: {
    nome: 'Goose',
    detectar: () => casa('.config', 'goose'),
    skills: 'agents',
    hooks: null, // hooks só dentro de plugins do Goose; o histórico vem do git status
  },
  roo: {
    nome: 'Roo Code',
    detectar: () => casa('.roo'),
    skills: 'agents',
    hooks: null,
  },
};

const PASTA_AGENTS = () => casa('.agents', 'skills');

function pluginOpenCode(raiz) {
  return `// Gerado pelo Scaffold Dev (${MARCA}). Reinstale com: node "${raiz}/scripts/install.js" opencode
import { spawnSync } from "node:child_process"

const RAIZ = ${JSON.stringify(raiz)}
const rodar = (script, entrada, args = []) =>
  spawnSync("node", [\`\${RAIZ}/scripts/hooks/\${script}\`, ...args], {
    input: JSON.stringify(entrada),
    encoding: "utf8",
    timeout: 10000,
  })

export const ScaffoldDev = async ({ client, directory }) => ({
  "tool.execute.after": async (input) => {
    try {
      rodar("post-tool.js", { tool_name: input.tool, tool_input: input.args, session_id: input.sessionID, cwd: directory })
    } catch {}
  },
  event: async ({ event }) => {
    if (event.type !== "session.idle") return
    try {
      const r = rodar("stop.js", { session_id: event.properties?.sessionID }, ["--formato", "texto", "--harness", "opencode"])
      const message = (r.stdout || "").trim()
      if (message) await client.tui.showToast({ body: { message, variant: "info" } })
    } catch {}
  },
})
`;
}

function pluginAmp(raiz) {
  return `// Gerado pelo Scaffold Dev (${MARCA}). Reinstale com: node "${raiz}/scripts/install.js" amp
import { spawnSync } from "node:child_process"

const RAIZ = ${JSON.stringify(raiz)}
const rodar = (script: string, entrada: unknown, args: string[] = []) =>
  spawnSync("node", [\`\${RAIZ}/scripts/hooks/\${script}\`, ...args], {
    input: JSON.stringify(entrada),
    encoding: "utf8",
    timeout: 10000,
  })

export default function (amp: any) {
  amp.on("tool.result", async (event: any) => {
    try {
      const sessao = event.thread?.id ?? null
      const uris = (await amp.helpers.filesModifiedByToolCall(event)) ?? []
      for (const uri of uris) {
        const file_path = await amp.helpers.filePathFromURI(uri)
        rodar("post-tool.js", { hook_event_name: "AfterFileEdit", file_path, cwd: process.cwd(), session_id: sessao })
      }
      const sh = await amp.helpers.shellCommandFromToolCall(event)
      if (sh?.command) {
        rodar("post-tool.js", { hook_event_name: "AfterShellExecution", command: sh.command, cwd: sh.dir ?? process.cwd(), session_id: sessao })
      }
    } catch {}
  })

  amp.on("agent.end", async (event: any, ctx: any) => {
    try {
      const r = rodar("stop.js", { session_id: event.thread?.id ?? null }, ["--formato", "texto", "--harness", "amp"])
      const msg = (r.stdout || "").trim()
      if (msg) await ctx.ui.notify(msg)
    } catch {}
  })
}
`;
}

module.exports = { HARNESSES, MARCA, PASTA_AGENTS, comandos };
