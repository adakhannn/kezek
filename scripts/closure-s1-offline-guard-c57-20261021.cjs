'use strict';
// Node restriction, not an OS firewall/native-network confinement claim.
const net = require('node:net');
const path = require('node:path');
const worker = path.resolve('C:/projects/kezek/test-results/closure-s1-20261021-c57-localfonts/build/apps/web/.next/build/postcss.js').toLowerCase();
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const port = Number(process.argv[2]);
    if (first && typeof first === 'object' && process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === worker && /^\d+$/.test(process.argv[2] || '') && port >= 1024 && port <= 65535 && port !== 3000 && first.host === '127.0.0.1' && Number(first.port) === port) return connect.apply(this, args);
    throw Object.assign(new Error('C57 offline compiler denies non-PostCSS TCP'), {code:'C57_BUILD_NETWORK_DISABLED'});
};
globalThis.fetch = async () => { throw Object.assign(new Error('C57 offline compiler denies fetch'), {code:'C57_BUILD_NETWORK_DISABLED'}); };
