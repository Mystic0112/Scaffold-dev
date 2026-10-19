'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Cada teste usa um diretório de dados isolado e roda fora de qualquer repositório git.
function dirTemporario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-dev-'));
  process.env.SCAFFOLD_DEV_HOME = path.join(dir, 'dados');
  process.env.SCAFFOLD_DEV_EXPORT_DIR = path.join(dir, 'estudos');
  const projeto = path.join(dir, 'projeto');
  fs.mkdirSync(projeto);
  process.chdir(projeto);
  return projeto;
}

module.exports = { dirTemporario };
