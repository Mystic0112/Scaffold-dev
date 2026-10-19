#!/usr/bin/env node
'use strict';

// Instala o Scaffold Dev em outros harnesses além do Claude Code.
//
//   node scripts/install.js                      lista harnesses e o que foi detectado
//   node scripts/install.js todos                instala em todos os harnesses detectados
//   node scripts/install.js codex cursor         instala só nesses
//   node scripts/install.js todos --sem-hooks    só os skills
//   node scripts/install.js todos --desinstalar  remove tudo que o Scaffold Dev criou
//
// Nunca sobrescreve config alheia: faz merge, guarda backup antes da primeira alteração
// e marca as próprias entradas para poder reinstalar e desinstalar com segurança.

const fs = require('fs');
const path = require('path');
const { HARNESSES, MARCA, PASTA_AGENTS } = require('./lib/harnesses');
const { portarSkill, PREFIXO } = require('./lib/portar');

const RAIZ = path.resolve(__dirname, '..');
const MARCA_SKILL = `<!-- gerado pelo Scaffold Dev (${MARCA}); não edite, reinstale -->`;

// ---------- skills ----------

function skillsPortados(raiz) {
  const dir = path.join(raiz, 'skills');
  return fs.readdirSync(dir).map((nome) => {
    const original = fs.readFileSync(path.join(dir, nome, 'SKILL.md'), 'utf8');
    // A pasta ~/.agents/skills é compartilhada por vários harnesses, então a forma de
    // invocar fica neutra (cada ferramenta tem a sua: $nome, /nome, @nome…).
    return portarSkill(original, { raiz, invocar: (n) => `o skill \`${n}\`` });
  });
}

function nossos(destino) {
  if (!fs.existsSync(destino)) return [];
  return fs.readdirSync(destino).filter((d) => {
    if (!d.startsWith(`${PREFIXO}-`)) return false;
    try {
      return fs.readFileSync(path.join(destino, d, 'SKILL.md'), 'utf8').includes(MARCA_SKILL);
    } catch {
      return false;
    }
  });
}

function instalarSkills(destino, raiz) {
  for (const d of nossos(destino)) fs.rmSync(path.join(destino, d), { recursive: true, force: true });
  const skills = skillsPortados(raiz);
  for (const { nome, texto } of skills) {
    const pasta = path.join(destino, nome);
    if (fs.existsSync(pasta)) throw new Error(`${pasta} já existe e não foi criado pelo Scaffold Dev`);
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'SKILL.md'), `${texto.trimEnd()}\n\n${MARCA_SKILL}\n`);
  }
  return skills.map((s) => s.nome);
}

function removerSkills(destino) {
  const lista = nossos(destino);
  for (const d of lista) fs.rmSync(path.join(destino, d), { recursive: true, force: true });
  return lista;
}

// ---------- hooks ----------

function semNossasEntradas(hooks) {
  const limpo = {};
  for (const [evento, entradas] of Object.entries(hooks || {})) {
    const resto = Array.isArray(entradas) ? entradas.filter((e) => !JSON.stringify(e).includes(MARCA)) : entradas;
    if (!Array.isArray(resto) || resto.length) limpo[evento] = resto;
  }
  return limpo;
}

function lerJsonExistente(arquivo) {
  if (!fs.existsSync(arquivo)) return {};
  const texto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '');
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${arquivo} não é um JSON válido — não vou mexer nele`);
  }
}

function backup(arquivo) {
  const bak = `${arquivo}.antes-scaffold-dev.bak`;
  if (fs.existsSync(arquivo) && !fs.existsSync(bak)) fs.copyFileSync(arquivo, bak);
}

function aplicarHooks(cfg, desinstalar) {
  if (cfg.tipo === 'json-merge') {
    const atual = lerJsonExistente(cfg.arquivo);
    const hooks = semNossasEntradas(atual.hooks);
    if (!desinstalar) {
      for (const [evento, entradas] of Object.entries(cfg.conteudo.hooks)) {
        hooks[evento] = [...(hooks[evento] || []), ...entradas];
      }
    }
    const novo = { ...atual, hooks };
    if (!desinstalar) for (const [k, v] of Object.entries(cfg.conteudo)) if (k !== 'hooks' && !(k in novo)) novo[k] = v;
    if (desinstalar && !Object.keys(hooks).length) delete novo.hooks;
    if (desinstalar && !fs.existsSync(cfg.arquivo)) return false;
    backup(cfg.arquivo);
    fs.mkdirSync(path.dirname(cfg.arquivo), { recursive: true });
    fs.writeFileSync(cfg.arquivo, JSON.stringify(novo, null, 2) + '\n');
    return true;
  }

  // tipo 'arquivo': o arquivo inteiro é nosso
  const existe = fs.existsSync(cfg.arquivo);
  if (existe && !fs.readFileSync(cfg.arquivo, 'utf8').includes(MARCA)) {
    throw new Error(`${cfg.arquivo} já existe e não foi criado pelo Scaffold Dev`);
  }
  if (desinstalar) {
    if (existe) fs.rmSync(cfg.arquivo);
    return existe;
  }
  const conteudo = typeof cfg.conteudo === 'string' ? cfg.conteudo : JSON.stringify(cfg.conteudo, null, 2) + '\n';
  fs.mkdirSync(path.dirname(cfg.arquivo), { recursive: true });
  fs.writeFileSync(cfg.arquivo, conteudo);
  return true;
}

// ---------- orquestração ----------

function detectados() {
  return Object.keys(HARNESSES).filter((id) => fs.existsSync(HARNESSES[id].detectar()));
}

function instalar({ alvos, raiz = RAIZ, desinstalar = false, semHooks = false }) {
  const log = [];
  const avisos = [];
  const pastasSkills = new Set();

  for (const id of alvos) {
    const h = HARNESSES[id];
    if (!h) {
      log.push(`✗ ${id}: harness desconhecido`);
      continue;
    }
    if (h.aviso) avisos.push(`${h.nome}: ${h.aviso}`);
    if (h.skills) pastasSkills.add(h.skills === 'agents' ? PASTA_AGENTS() : h.skills());

    if (!h.hooks || semHooks) {
      if (!h.hooks && !desinstalar && h.skills) log.push(`• ${h.nome}: sem hooks — o histórico de mudanças vem do git status`);
      continue;
    }
    const cfg = h.hooks(raiz);
    try {
      const mudou = aplicarHooks(cfg, desinstalar);
      if (mudou) log.push(`✓ ${h.nome}: hooks ${desinstalar ? 'removidos de' : 'em'} ${cfg.arquivo}`);
      if (cfg.aviso && !desinstalar) avisos.push(`${h.nome}: ${cfg.aviso}`);
    } catch (e) {
      log.push(`✗ ${h.nome}: ${e.message}`);
    }
  }

  for (const pasta of pastasSkills) {
    try {
      const nomes = desinstalar ? removerSkills(pasta) : instalarSkills(pasta, raiz);
      log.push(`✓ ${nomes.length} skills ${desinstalar ? 'removidos de' : 'em'} ${pasta}`);
    } catch (e) {
      log.push(`✗ skills em ${pasta}: ${e.message}`);
    }
  }
  return { log, avisos };
}

function ajuda() {
  const achados = new Set(detectados());
  const linhas = Object.entries(HARNESSES).map(
    ([id, h]) =>
      `  ${achados.has(id) ? '●' : '○'} ${id.padEnd(12)} ${h.nome}` +
      (h.skills === null ? '  (use o plugin nativo)' : h.hooks ? '' : '  (sem hooks; usa git status)'),
  );
  return [
    'Scaffold Dev — instalador multi-harness',
    '',
    'Uso: node scripts/install.js <todos | harness...> [--sem-hooks] [--desinstalar]',
    '',
    'Harnesses (● = detectado nesta máquina):',
    ...linhas,
  ].join('\n');
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const nomes = argv.filter((a) => !a.startsWith('--'));
  if (!nomes.length) return { codigo: 0, saida: ajuda() };

  const alvos = nomes.includes('todos') ? detectados() : nomes;
  if (!alvos.length) return { codigo: 1, saida: 'Nenhum harness detectado. Diga quais usar, ex.: node scripts/install.js codex cursor' };

  const desinstalar = flags.has('--desinstalar');
  const { log, avisos } = instalar({ alvos, desinstalar, semHooks: flags.has('--sem-hooks') });
  const saida = [...log];
  if (avisos.length) saida.push('', 'Atenção:', ...avisos.map((a) => `  - ${a}`));
  if (!desinstalar) {
    saida.push(
      '',
      'Pronto. Abra o seu agente e chame um skill, ex.: scaffold-dev-progresso',
      '($scaffold-dev-progresso no Codex, /scaffold-dev-progresso no Copilot, Cursor, Kiro e Cline, @scaffold-dev-progresso no Windsurf, ou peça "use o skill scaffold-dev-progresso").',
      'Se mover a pasta do Scaffold Dev, rode o instalador de novo.',
    );
  }
  return { codigo: log.some((l) => l.startsWith('✗')) ? 1 : 0, saida: saida.join('\n') };
}

if (require.main === module) {
  const { codigo, saida } = main(process.argv.slice(2));
  process.stdout.write(saida + '\n');
  process.exit(codigo);
}

module.exports = { instalar, aplicarHooks, semNossasEntradas, skillsPortados, main, MARCA_SKILL };
