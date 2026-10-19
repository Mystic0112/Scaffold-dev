'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Cada teste usa um diretório de dados isolado.
function dirTemporario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-dev-'));
  process.env.SCAFFOLD_DEV_HOME = dir;
  process.env.SCAFFOLD_DEV_EXPORT_DIR = path.join(dir, 'estudos');
  return dir;
}

module.exports = { dirTemporario };
