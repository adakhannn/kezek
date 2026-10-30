// C07 bounded server for exact isolated output. No real credentials or DB network.
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const cwd = path.resolve('C:/projects/kezek/test-results/closure-s1-20261020-f004-fontread/build/apps/web');
if (!fs.existsSync(path.join(cwd, '.next/BUILD_ID'))) throw Error('No completed isolated build');
if (Date.now() >= Date.parse('2026-10-20T12:15:00Z')) throw Error('New scenario window expired');
const env = {};
const allow = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'processor_architecture', 'number_of_processors']);
for (const [k, v] of Object.entries(process.env)) if (allow.has(k.toLowerCase())) env[k] = v;
Object.assign(env, { NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: '--max-old-space-size=768 --require=C:/projects/kezek/scripts/closure-s1-build-network.cjs',
  NEXT_PUBLIC_SUPABASE_URL: 'https://closure-s1.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-credential',
  NEXT_PUBLIC_SITE_URL: 'https://closure-s1.invalid', SUPABASE_SERVICE_ROLE_KEY: '',
  SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_DSN: '' });
const child = spawn(process.execPath, [path.join(cwd, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3104'], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(JSON.stringify({ event: 'spawned', pid: child.pid, utc: new Date().toISOString(), origin: 'http://s1chunkfix-20261020-bbc338.localhost:3104', automaticStopSeconds: 300, network: 'all outbound Node TCP/fetch denied; dummy invalid backend; no real credentials' }));
child.stdout.on('data', b => process.stdout.write(b));
child.stderr.on('data', b => process.stderr.write(b));
const timer = setTimeout(() => child.kill(), 300000);
child.on('error', e => console.error(String(e)));
child.on('close', (exitCode, signal) => { clearTimeout(timer); console.log(JSON.stringify({ event: 'stopped', pid: child.pid, utc: new Date().toISOString(), exitCode, signal })); });
