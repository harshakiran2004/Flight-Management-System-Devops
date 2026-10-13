const crypto = require('crypto');

function createIdentifier(prefix, length = 8) {
  return `${prefix}-${crypto.randomBytes(length).toString('hex').toUpperCase()}`;
}

function createPNR() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

module.exports = { createIdentifier, createPNR };
