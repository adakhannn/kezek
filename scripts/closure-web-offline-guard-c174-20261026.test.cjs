'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { allowsPostcss, worker } = require('./closure-web-offline-guard-c174-20261026.cjs');
const argv = ['node', worker, '42617'];
test('exact PostCSS IPC predicate permits only expected loopback worker (no connection)', () => {
    assert.equal(allowsPostcss([{ host: '127.0.0.1', port: 42617 }], argv), true);
    assert.equal(allowsPostcss([[{ host: '127.0.0.1', port: 42617 }]], argv), true);
});
for (const [name, args, processArgs] of [
    ['DEV host', [{ host: 'beulnmftzbmtbdlgurht.supabase.co', port: 443 }], argv],
    ['Google fonts', [{ host: 'fonts.googleapis.com', port: 443 }], argv],
    ['GitHub', [{ host: 'github.com', port: 443 }], argv],
    ['other loopback host', [{ host: 'localhost', port: 42617 }], argv],
    ['IPv6', [{ host: '::1', port: 42617 }], argv],
    ['wrong port', [{ host: '127.0.0.1', port: 42618 }], argv],
    ['main app port', [{ host: '127.0.0.1', port: 3000 }], ['node', worker, '3000']],
    ['privileged port', [{ host: '127.0.0.1', port: 443 }], ['node', worker, '443']],
    ['out of range', [{ host: '127.0.0.1', port: 65536 }], ['node', worker, '65536']],
    ['wrong worker', [{ host: '127.0.0.1', port: 42617 }], ['node', 'other.js', '42617']],
    ['malformed port', [{ host: '127.0.0.1', port: 42617 }], ['node', worker, '42617x']],
    ['positional connect', [42617, '127.0.0.1'], argv],
    ['named pipe', [{ path: 'pipe' }], argv],
]) test('deny '+name+' without network', () => assert.equal(allowsPostcss(args, processArgs), false));
test('ordinary Node TCP is denied before connection', () => {
    assert.throws(() => new net.Socket().connect({ host: '127.0.0.1', port: 3000 }), { code: 'C174_BUILD_NETWORK_DISABLED' });
});
test('fetch is denied without reaching a host', async () => {
    await assert.rejects(fetch('https://closure-c174.invalid'), { code: 'C174_BUILD_NETWORK_DISABLED' });
});
