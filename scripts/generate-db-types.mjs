// Generates apps/web/src/types/supabase.ts from a running local Supabase stack
// (`supabase start` / `supabase db reset`, i.e. baseline + migrations), then
// normalises the output with the TypeScript printer so diffs stay readable.
//
//   node scripts/generate-db-types.mjs --write [--workdir <dir>]
//   node scripts/generate-db-types.mjs --check [--workdir <dir>]
//
// --workdir points at a directory whose supabase/ folder runs the stack
// (default: repository root).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'apps/web/src/types/supabase.ts');
const args = process.argv.slice(2);
const mode = args.includes('--write') ? 'write' : args.includes('--check') ? 'check' : null;
if (!mode) throw new Error('Usage: generate-db-types.mjs --write|--check [--workdir <dir>]');
const workdirIndex = args.indexOf('--workdir');
const workdir = workdirIndex >= 0 ? path.resolve(args[workdirIndex + 1]) : root;

const cli = path.join(root, 'node_modules/.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const result = spawnSync(cli, ['gen', 'types', 'typescript', '--local', '--schema', 'public', '--workdir', workdir], {
    cwd: workdir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
    windowsHide: true,
});
if (result.status !== 0 || !result.stdout.trim()) {
    process.stderr.write(result.stderr || 'supabase gen types produced no output\n');
    process.exit(result.status || 1);
}

const ts = createRequire(path.join(root, 'apps/web/package.json'))('typescript');
const source = ts.createSourceFile('supabase.ts', result.stdout, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const generated = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);

if (mode === 'write') {
    fs.writeFileSync(target, generated);
    console.log(`Wrote ${path.relative(root, target)} from the local database schema.`);
} else {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== generated) {
        console.error(`${path.relative(root, target)} is stale. Run: pnpm generate:db-types (with the local stack running).`);
        process.exit(1);
    }
    console.log('Database types match the local schema (baseline + migrations).');
}
