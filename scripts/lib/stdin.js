'use strict';

// Lê o JSON que o Claude Code envia para o hook via stdin.
function lerEntrada() {
  return new Promise((resolve) => {
    let dados = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (dados += c));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(dados || '{}'));
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

module.exports = { lerEntrada };
