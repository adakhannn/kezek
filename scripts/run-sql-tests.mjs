import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const scenarioFile = fileURLToPath(new URL('../supabase/tests_critical_scenarios.sql', import.meta.url));

/** One explicit target, one invocation; SQL failure must never trigger a second runner. */
export function runSqlTests({ env = process.env, spawn = spawnSync, report = console.error } = {}) {
    const target = env.SUPABASE_DB_URL;
    if (typeof target !== 'string' || !target.trim()) {
        report('SUPABASE_DB_URL is required. Select an explicitly authorized isolated test database.');
        return 2;
    }
    const result = spawn('psql', ['-X', '--no-password', '--set=ON_ERROR_STOP=1',
        `--dbname=${target}`, '--file', scenarioFile], {
        env, stdio: 'inherit', shell: false, windowsHide: true,
    });
    if (result.error || result.signal || result.status === null) {
        report('SQL runner could not complete; no fallback or retry was attempted.');
        return 1;
    }
    return result.status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = runSqlTests();
}
