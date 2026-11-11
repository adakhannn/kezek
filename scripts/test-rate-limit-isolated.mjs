import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const source = readFileSync(new URL('../apps/web/src/lib/rateLimit.ts', import.meta.url), 'utf8');
const script = source.match(/export const RATE_LIMIT_SCRIPT = `([\s\S]*?)`;/)?.[1];
assert.ok(script, 'production Lua script must be present');
const container = `kezek-rate-limit-${randomUUID()}`;
const docker = (args, allowFailure = false) => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '', error = '';
    child.stdout.on('data', data => { out += data; });
    child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 || allowFailure ? resolve(out.trim()) : reject(new Error(error || out || `exit ${code}`)));
});
const command = (...args) => docker(['exec', container, 'redis-cli', '--raw', ...args]);
const evaluate = async (keys, windows, limits = keys.map(() => 100000)) => (await command('EVAL', script, String(keys.length), ...keys, ...windows.map(String), ...limits.map(String)))
    .split('\n').map(Number);
let created = false;
try {
    await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/data', '--name', container,
        'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no']);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if (await command('PING') === 'PONG') { ready = true; break; } } catch { /* startup only */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'disposable Redis startup');
    const results = await Promise.all(Array.from({ length: 40 }, () => evaluate(['shared'], [60000], [5])));
    assert.deepEqual(results.map(value => value[0]).filter(count => count <= 5).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
    assert.equal(results.filter(([count]) => count <= 5).length, 5, 'exactly five requests fit the shared budget');
    assert.ok(results.every(([, ttl]) => ttl > 0 && ttl <= 60000));
    assert.equal(await command('GET', 'shared'), '5');
    console.log('PASS concurrent atomic counters and bounded TTL');

    await command('SET', 'orphan', '6');
    assert.equal(await command('PTTL', 'orphan'), '-1');
    const repaired = await evaluate(['orphan'], [60000]);
    assert.equal(repaired[0], 7);
    assert.ok(repaired[1] > 0 && repaired[1] <= 60000);
    await command('PEXPIRE', 'orphan', '1000');
    const live = await evaluate(['orphan'], [60000]);
    assert.equal(live[0], 8);
    assert.ok(live[1] >= 0 && live[1] <= 1000, 'live window must not be extended');
    console.log('PASS orphan TTL repair without extending live windows');

    await command('SET', 'expired', '9', 'PX', '1');
    await new Promise(resolve => setTimeout(resolve, 20));
    const fresh = await evaluate(['expired'], [1000]);
    assert.equal(fresh[0], 1);
    assert.ok(fresh[1] > 0 && fresh[1] <= 1000);
    assert.deepEqual((await evaluate(['user-a', 'tenant-a'], [60000, 60000])).filter((_, index) => index % 2 === 0), [1, 1]);
    assert.deepEqual((await evaluate(['user-b', 'tenant-a'], [60000, 60000])).filter((_, index) => index % 2 === 0), [1, 2]);
    await evaluate(['user-a', 'tenant-a'], [60000, 60000], [1, 60]);
    assert.equal(await command('GET', 'tenant-a'), '2', 'denied user retry must not exhaust a shared tenant budget');
    console.log('PASS expiry restart and separate principal/shared tenant counters');
} finally {
    if (created) await docker(['rm', '--force', container]);
}
