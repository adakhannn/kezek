import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const scenarioFile = fileURLToPath(new URL('../supabase/tests_critical_scenarios.sql', import.meta.url));

// The legacy scenarios create businesses, shifts and bookings and recalculate ratings for the
// whole database. A developer's SUPABASE_DB_URL may point at production, and `pnpm test` runs
// them first (CI-06), so the target must be local unless one remote host is authorized
// explicitly, the production project is refused always, and the run is rolled back.
const PRODUCTION_PROJECT_REF = 'beulnmftzbmtbdlgurht';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

/** The host a libpq URL or key=value connection string points at, or null. */
export function databaseHost(target) {
    const text = target.trim();
    if (/^postgres(ql)?:\/\//i.test(text)) {
        try {
            const url = new URL(text);
            return url.hostname || url.searchParams.get('host') || 'localhost';
        } catch {
            return null;
        }
    }
    const host = /(?:^|\s)host\s*=\s*'?([^\s']+)/i.exec(text);
    return host ? host[1] : null;
}

/** Null when the target may run the scenarios, otherwise the reason it may not. */
export function refuseTarget(target, env) {
    if (target.includes(PRODUCTION_PROJECT_REF)) return 'The production project is never a test target.';
    const host = databaseHost(target);
    if (!host) return 'The database host cannot be determined from SUPABASE_DB_URL.';
    const normalized = host.toLowerCase();
    // A host without dots is a container or service name on a local network.
    if (LOCAL_HOSTS.has(normalized) || !normalized.includes('.')) return null;
    const authorized = (env.KEZEK_SQL_TESTS_TARGET_HOST ?? '').trim().toLowerCase();
    if (authorized && authorized === normalized) return null;
    return 'SUPABASE_DB_URL is not local. Set KEZEK_SQL_TESTS_TARGET_HOST to this exact host to authorize an isolated remote test database.';
}

/** One explicit target, one invocation; SQL failure must never trigger a second runner. */
export function runSqlTests({ env = process.env, spawn = spawnSync, report = console.error } = {}) {
    const target = env.SUPABASE_DB_URL;
    if (typeof target !== 'string' || !target.trim()) {
        report('SUPABASE_DB_URL is required. Select an explicitly authorized isolated test database.');
        return 2;
    }
    const refusal = refuseTarget(target, env);
    if (refusal) {
        report(refusal);
        return 2;
    }
    // One session: the scenarios run inside a transaction that is rolled back, so even an
    // authorized database keeps no test rows and no recalculated ratings.
    const result = spawn('psql', ['-X', '--no-password', '--set=ON_ERROR_STOP=1',
        `--dbname=${target}`, '--command', 'begin', '--file', scenarioFile, '--command', 'rollback'], {
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
