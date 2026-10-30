// C15 F004 current candidate compiler probe. User approved only public Google Fonts GET until12:30UTC. Mechanical source copy; no user env, DB or browser requests.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const repo = 'C:/projects/kezek';
const runName = 'closure-s1-20261020-f005-fontread-v2';
const parent = path.resolve(repo, 'test-results', runName);
const dest = path.resolve(parent, 'build');
if (Date.now() >= Date.parse('2026-10-20T12:15:00Z')) throw Error('Execution window expired');
if (path.dirname(dest) !== parent || fs.existsSync(dest)) throw Error('Requires new exact isolated directory');
const selection = [
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'apps/web/package.json', 'apps/web/pnpm-lock.yaml', 'apps/web/tsconfig.json',
  'apps/web/next.config.ts', 'apps/web/postcss.config.mjs', 'apps/web/next-env.d.ts',
  'apps/web/src', 'apps/web/public',
  'packages/core-domain/package.json', 'packages/core-domain/tsconfig.json', 'packages/core-domain/src',
  'packages/shared-client/package.json', 'packages/shared-client/tsconfig.json', 'packages/shared-client/src',
];
const entries = [];
function copy(relative) {
  const source = path.join(repo, relative), target = path.join(dest, relative), stat = fs.lstatSync(source);
  const name = path.basename(relative);
  if (stat.isSymbolicLink() || name.startsWith('.env') || ['.git', '.next', 'node_modules', 'test-results'].includes(name)) throw Error('Excluded copy path: ' + relative);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const child of fs.readdirSync(source).sort()) copy(path.join(relative, child));
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    entries.push([relative.replaceAll('\\', '/'), createHash('sha256').update(fs.readFileSync(source)).digest('hex')]);
  } else throw Error('Unsupported copy path');
}
for (const p of selection) copy(p);
const certifiedPaths = JSON.parse(fs.readFileSync(path.join(repo, 'docs/verification/runs/2026-10-20-s1-continuation/c14-source-paths.json')));
const copied = new Map(entries);
if (certifiedPaths.length !== entries.length || certifiedPaths.some(file => !copied.has(file))) throw Error('Copy selection changed');
const orderedEntries = certifiedPaths.map(file => [file, copied.get(file)]);
const fingerprint = createHash('sha256').update(JSON.stringify(orderedEntries)).digest('hex');
if (entries.length !== 1663 || fingerprint !== '1c0013b28e404ff2c414bb44c9f1d27a0dd63f00cdf1695bfad54f84b5ded46a') throw Error('Candidate changed; do not build another source silently');
for (const p of ['node_modules', 'apps/web/node_modules', 'packages/core-domain/node_modules', 'packages/shared-client/node_modules']) {
  if (fs.existsSync(path.join(repo, p))) fs.symlinkSync(path.join(repo, p), path.join(dest, p), 'junction');
}
const env = {};
const allow = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'processor_architecture', 'number_of_processors']);
for (const [k, v] of Object.entries(process.env)) if (allow.has(k.toLowerCase())) env[k] = v;
Object.assign(env, { NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: '--max-old-space-size=2048 --require=C:/projects/kezek/scripts/closure-s1-build-network.cjs',
  NEXT_PUBLIC_SUPABASE_URL: 'https://closure-s1.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-credential',
  NEXT_PUBLIC_SITE_URL: 'https://closure-s1.invalid', SUPABASE_SERVICE_ROLE_KEY: '',
  SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_DSN: '' });
const cwd = path.join(dest, 'apps/web');
env.NODE_OPTIONS = `--max-old-space-size=2048 --require=${repo}/scripts/closure-s1-font-read-guard-f005-20261020.cjs`;
const startedUtc = new Date().toISOString();
console.log(JSON.stringify({ event: 'prepared', startedUtc, dest, copiedFiles: entries.length,
  copyFingerprint: fingerprint,
  noEnvFiles: true, primarySourceConfigUnchanged: true, coldNextCache: true,
  limitations: 'Dummy nonproduction config; Node network restriction not OS firewall; not live or release PASS.' }));
const child = spawn(process.execPath, [path.join(cwd, 'node_modules/next/dist/bin/next'), 'build'], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(JSON.stringify({ event: 'spawned', pid: child.pid }));
child.stdout.on('data', b => process.stdout.write(b));
child.stderr.on('data', b => process.stderr.write(b));
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  if (child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}, 240000);
child.on('error', e => console.error(String(e)));
child.on('close', (exitCode, signal) => {
  clearTimeout(timer);
  console.log(JSON.stringify({ event: 'finished', startedUtc, finishedUtc: new Date().toISOString(), exitCode, signal, timedOut, pid: child.pid, dest }));
  process.exitCode = exitCode === 0 && !timedOut ? 0 : 1;
});
