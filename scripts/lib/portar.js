'use strict';

// Converte um SKILL.md escrito para o plugin do Claude Code no formato
// Agent Skills genérico (agentskills.io), usado pelos outros harnesses.

const PREFIXO = 'scaffold-dev';
const ARGUMENTOS = '(o que o usuário escreveu junto com o pedido deste skill; se não escreveu nada, considere vazio)';

function separarFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { campos: {}, corpo: texto };
  const campos = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(':');
    if (i > 0) campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  return { campos, corpo: texto.slice(m[0].length) };
}

function aspas(valor) {
  const v = String(valor).replace(/^"(.*)"$/, '$1');
  return JSON.stringify(v);
}

/**
 * @param {string} texto   conteúdo do SKILL.md original
 * @param {object} opts
 * @param {string} opts.raiz      caminho absoluto do repositório do Scaffold Dev
 * @param {(nome: string) => string} opts.invocar  como o usuário chama um skill nesse harness
 * @returns {{ nome: string, texto: string }}
 */
function portarSkill(texto, { raiz, invocar }) {
  const { campos, corpo } = separarFrontmatter(texto);
  if (!campos.name) throw new Error('SKILL.md sem campo name');
  const nome = `${PREFIXO}-${campos.name}`;
  const raizBarra = raiz.replace(/\\/g, '/');

  const novoCorpo = corpo
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, raizBarra)
    .replace(/\/scaffold-dev:([a-z-]+)/g, (_, s) => invocar(`${PREFIXO}-${s}`))
    .replace(/\$ARGUMENTS/g, ARGUMENTOS);

  // Só os campos do padrão aberto; campos exclusivos do Claude Code ficam de fora.
  const frontmatter = [`---`, `name: ${nome}`, `description: ${aspas(campos.description || '')}`, `---`, ''].join('\n');
  return { nome, texto: frontmatter + novoCorpo };
}

module.exports = { portarSkill, separarFrontmatter, PREFIXO };
