import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const source = readFileSync(new URL('../apps/web/src/lib/performanceStore.ts', import.meta.url), 'utf8');
const write = source.match(/export const PERFORMANCE_WRITE_SCRIPT = `([\s\S]*?)`;/)?.[1];
const read = source.match(/export const PERFORMANCE_READ_SCRIPT = `([\s\S]*?)`;/)?.[1];
assert.ok(write && read, 'test the production Lua, not a duplicate implementation');
const container = `kezek-performance-${randomUUID()}`;
const docker = (args, allowFailure = false) => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 || allowFailure ? resolve(output.trim()) : reject(new Error(error || output || `exit ${code}`)));
});
const command = async (...args) => JSON.parse(await docker(['exec', container, 'redis-cli', '--json', ...args.map(String)]));
const prefix = 'performance:v1:server:shift_close';
const writeFromInstance = value => command('EVAL', write, 1, prefix, value, value === 10 ? 'success' : 'error', value === 10 ? 2 : 4);
const readFromInstance = () => command('EVAL', read, 2, prefix, 'performance:v1:client:CLS');
let created = false;
try {
    await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/data', '--name', container, 'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no']);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if (await command('PING') === 'PONG') { ready = true; break; } } catch { /* startup only */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    // Keep concurrent writes away from a real minute rollover; the test never
    // replaces Redis TIME with the application's clock.
    const initialTime = await command('TIME');
    const second = Number(initialTime[0]) % 60;
    if (second > 30) await new Promise(resolve => setTimeout(resolve, (61 - second) * 1000));
    // Each call uses a separate redis-cli process; no shared JS state can merge it.
    await Promise.all(Array.from({ length: 24 }, (_, index) => writeFromInstance(index % 2 ? 10 : 50)));
    const serverTime = await command('TIME');
    const minute = Math.floor(Number(serverTime[0]) / 60);
    const key = `${prefix}:${minute}`;
    assert.equal(await command('HGET', key, 'count'), '24');
    assert.equal(await command('HGET', key, 'error'), '12');
    assert.equal(await command('HGET', key, 'sum'), '720');
    const ttl = await command('TTL', key);
    assert.ok(ttl > 0 && ttl <= 900, 'fixed 15-minute retention');
    const current = await readFromInstance();
    assert.equal(current[3][0][0], 0, 'current partial minute is deliberately excluded');
    assert.equal(current[2] - current[1], 300000);
    console.log('PASS independent writers merge atomically; Redis TIME owns the window and retention');

    // Seed completed-time fixtures by renaming keys; no app clock injection and no
    // 15-minute sleep. The production reader must include/exclude exact boundaries.
    await command('RENAME', key, `${prefix}:${minute - 1}`);
    const aggregate = await readFromInstance();
    assert.deepEqual(aggregate[3][0].slice(0, 6), [24, 12, 0, '720', '10', '50']);
    assert.equal(aggregate[3][0][8], 12); // histogram b2
    assert.equal(aggregate[3][0][10], 12); // histogram b4
    await command('COPY', `${prefix}:${minute - 1}`, `${prefix}:${minute - 5}`);
    assert.equal((await readFromInstance())[3][0][0], 48, 'oldest completed minute is included');
    await command('RENAME', `${prefix}:${minute - 5}`, `${prefix}:${minute - 6}`);
    assert.equal((await readFromInstance())[3][0][0], 24, 'older samples are excluded even before TTL cleanup');
    assert.equal((await readFromInstance())[3][1][0], 0, 'browser and server data remain separate');
    await command('PEXPIRE', `${prefix}:${minute - 1}`, 1);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await readFromInstance())[3][0][0], 0, 'expired aggregate disappears');
    const saturatedPrefix = 'performance:v1:server:recalculate_ratings';
    const saturatedMinute = Math.floor(Number((await command('TIME'))[0]) / 60);
    const saturatedKey = `${saturatedPrefix}:${saturatedMinute}`;
    await command('HSET', saturatedKey, 'count', 10000000);
    assert.equal(await command('EVAL', write, 1, saturatedPrefix, 1, 'success', 0), 0);
    assert.equal(await command('HGET', saturatedKey, 'count'), '10000000', 'counter ceiling cannot grow without bound');
    assert.ok(await command('TTL', saturatedKey) > 0, 'even a saturated orphan is bounded by retention');
    console.log('PASS shared read, histogram/error totals, aligned window boundaries, namespace separation and expiry');
} finally {
    if (created) await docker(['rm', '--force', container]);
}
