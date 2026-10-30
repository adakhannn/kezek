'use strict';
// Restricts this Node compiler only; not an OS firewall/native-network claim.
const net = require('node:net');
const path = require('node:path');
const worker = path.resolve('C:/projects/kezek/test-results/closure-web-20261026-c206-5387d70d6af1/build/apps/web/.next/build/postcss.js').toLowerCase();
function allowsPostcss(args, argv = process.argv) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const port = Number(argv[2]);
    return Boolean(first && typeof first === 'object' && argv[1]
        && path.resolve(argv[1]).toLowerCase() === worker
        && /^\d+$/.test(argv[2] || '') && port >= 1024 && port <= 65535 && port !== 3000
        && first.host === '127.0.0.1' && Number(first.port) === port);
}
const denied = () => Object.assign(new Error('C206 offline compiler denies non-PostCSS network'), { code: 'C206_BUILD_NETWORK_DISABLED' });
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    if (allowsPostcss(args)) return connect.apply(this, args);
    throw denied();
};
globalThis.fetch = async () => { throw denied(); };
module.exports = { allowsPostcss, worker };
