// One bounded, user-authorized public DEV read scenario. Never loads service-role or user sessions.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = 'C:/projects/kezek';
const mode = process.argv[2] || 'recovery';
if (!['recovery', 'pending'].includes(mode)) throw Error('Unknown read-only scenario');
const buildName = process.argv[3] || 'closure-s1-20261018-f001';
if (!['closure-s1-20261018-f001', 'closure-s1-20261018-f002', 'closure-s1-20261018-f002-functional'].includes(buildName)) throw Error('Unknown isolated build');
const flag = `${root}/docs/verification/runs/2026-10-18-s1/s18-network-open.json`;
if (Date.now() >= Date.parse('2026-10-18T12:20:00Z') || fs.existsSync(flag)) throw Error('Expired or previously opened scenario');
const publicValues = {};
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const file = `${root}/apps/web/${name}`;
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/);
    if (match) publicValues[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
if (publicValues.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== 'https://beulnmftzbmtbdlgurht.supabase.co') throw Error('Unexpected public DEV project');
const anon = publicValues.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Existing public SDK key only; never accept a service-role JWT.
if (!anon.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(anon.split('.')[1], 'base64url').toString()).role; } catch { /* reject */ }
  if (role !== 'anon') throw Error('Existing public anonymous key unavailable');
}
const env = {};
const allow = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'processor_architecture', 'number_of_processors']);
for (const [key, value] of Object.entries(process.env)) if (allow.has(key.toLowerCase())) env[key] = value;
Object.assign(env, { NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: `--max-old-space-size=768 --require=${root}/scripts/closure-s1-public-${mode === 'pending' ? 'pending-guard' : 'read-guard'}.cjs`, ...publicValues, SUPABASE_SERVICE_ROLE_KEY: '', SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_DSN: '', NEXT_PUBLIC_SITE_URL: 'https://closure-s1.invalid' });
const cwd = `${root}/test-results/${buildName}/build/apps/web`;
const child = spawn(process.execPath, [path.join(cwd, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3103'], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(JSON.stringify({ event: 'spawned', pid: child.pid, utc: new Date().toISOString(), origin: 'http://127.0.0.1:3103', mode, network: 'initially blocked; flag permits validated public anonymous GET only', automaticStopSeconds: 480 }));
child.stdout.on('data', b => process.stdout.write(b));
child.stderr.on('data', b => process.stderr.write(b));
const timer = setTimeout(() => child.kill(), 480000);
child.on('error', () => console.error('Owned recovery child failed'));
child.on('close', (exitCode, signal) => { clearTimeout(timer); console.log(JSON.stringify({ event: 'stopped', pid: child.pid, utc: new Date().toISOString(), exitCode, signal })); });
