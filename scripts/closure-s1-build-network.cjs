'use strict';
// Constrains this isolated build, never weakens the app or probes a blocked endpoint.
const net = require('node:net');
const path = require('node:path');
const entries = ['closure-s1-20261018', 'closure-s1-20261018-f001', 'closure-s1-20261018-f002'].map(name => path.resolve('C:/projects/kezek/test-results', name, 'build/apps/web/.next/build/postcss.js').toLowerCase());
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const port = Number(process.argv[2]);
  if (first && typeof first === 'object' && process.argv[1] && entries.includes(path.resolve(process.argv[1]).toLowerCase()) && /^\d+$/.test(process.argv[2] || '') && port >= 1024 && port <= 65535 && port !== 3000 && first.host === '127.0.0.1' && Number(first.port) === port) return connect.apply(this, args);
  throw Object.assign(new Error('S1 isolated build denies non-PostCSS TCP'), { code: 'S1_BUILD_NETWORK_DISABLED' });
};
globalThis.fetch = async () => { throw Object.assign(new Error('S1 isolated build denies fetch'), { code: 'S1_BUILD_NETWORK_DISABLED' }); };
