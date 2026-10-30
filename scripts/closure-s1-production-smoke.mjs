// Bounded owned server for the isolated build; no real credentials or DB connectivity.
import path from 'node:path';
import { spawn } from 'node:child_process';
const runName = process.argv[2] || 'closure-s1-20261018';
if (!['closure-s1-20261018', 'closure-s1-20261018-f001', 'closure-s1-20261018-f002-fontread'].includes(runName)) throw Error('Unknown isolated run');
const cwd = path.resolve('C:/projects/kezek/test-results', runName, 'build/apps/web');
const port = runName === 'closure-s1-20261018' ? '3102' : '3103';
const mode = process.argv[3] || 'blocked';
if (!['blocked', 'missing', 'invalid'].includes(mode)) throw Error('Unknown isolated configuration mode');
if (Date.now() >= Date.parse(runName === 'closure-s1-20261018-f002-fontread' ? '2026-10-18T12:34:00Z' : '2026-10-18T12:25:00Z')) throw Error('Execution window expired');
const env = {};
const allow = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'processor_architecture', 'number_of_processors']);
for (const [k, v] of Object.entries(process.env)) if (allow.has(k.toLowerCase())) env[k] = v;
Object.assign(env, { NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: '--max-old-space-size=768 --require=C:/projects/kezek/scripts/closure-s1-build-network.cjs',
  NEXT_PUBLIC_SUPABASE_URL: 'https://closure-s1.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-credential',
  NEXT_PUBLIC_SITE_URL: 'https://closure-s1.invalid', SUPABASE_SERVICE_ROLE_KEY: '',
  SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_DSN: '' });
if (mode === 'missing') {
  env.NEXT_PUBLIC_SUPABASE_URL = '';
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
} else if (mode === 'invalid') {
  env.NEXT_PUBLIC_SUPABASE_URL = 's15-invalid-url';
}
const child = spawn(process.execPath, [path.join(cwd, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', port], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(JSON.stringify({ event: 'spawned', pid: child.pid, utc: new Date().toISOString(), origin: `http://127.0.0.1:${port}`, mode, automaticStopSeconds: 300 }));
child.stdout.on('data', b => process.stdout.write(b));
child.stderr.on('data', b => process.stderr.write(b));
const timer = setTimeout(() => child.kill(), 300000);
child.on('error', e => console.error(String(e)));
child.on('close', (exitCode, signal) => { clearTimeout(timer); console.log(JSON.stringify({ event: 'stopped', pid: child.pid, utc: new Date().toISOString(), exitCode, signal })); });
