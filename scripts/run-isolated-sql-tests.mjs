import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
export const isolatedSqlSuites = JSON.parse(fs.readFileSync(path.join(directory, 'sql-isolated-suites.json'), 'utf8'));
if (!Array.isArray(isolatedSqlSuites) || !isolatedSqlSuites.length ||
    new Set(isolatedSqlSuites).size !== isolatedSqlSuites.length ||
    isolatedSqlSuites.some(file => typeof file !== 'string' || !/^test-[a-z0-9-]+\.(mjs|cjs)$/.test(file) || !fs.existsSync(path.join(directory, file)))) {
    throw new Error('Invalid isolated SQL suite registry');
}

export function runIsolatedSqlSuites(run = spawnSync) {
    for (const file of isolatedSqlSuites) {
        const result = run(process.execPath, [path.join(directory, file)], { shell: false, stdio: 'inherit', windowsHide: true });
        if (result.error || result.signal || result.status !== 0) return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length !== 2) throw new Error('Unexpected isolated SQL runner arguments');
    process.exitCode = runIsolatedSqlSuites();
}
