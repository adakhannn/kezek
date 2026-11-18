// The disposable PostgreSQL of the explicit-schedule suites (CI-03), with the container lifecycle of
// the registered isolated suites: the image of lib/isolated-postgres.cjs, no network, no host port or
// volume, data on tmpfs, the container removed when the suite ends. No Supabase project, .env or
// credentials are read.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { POSTGRES_IMAGE } = require('./isolated-postgres.cjs');

function docker(args, input = '') {
    return new Promise((resolve, reject) => {
        const child = spawn('docker', args, { windowsHide: true });
        let out = '';
        let err = '';
        child.stdout.on('data', (data) => { out += data; });
        child.stderr.on('data', (data) => { err += data; });
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `docker exit ${code}`))));
        child.stdin.end(input);
    });
}

/**
 * Starts a fresh PostgreSQL, runs `body(sql)` and removes the container whatever happens. `sql` runs
 * its text as postgres in one psql session (-X -q -v ON_ERROR_STOP=1 -At) and resolves to the output.
 */
export async function withSchedulePostgres(prefix, body) {
    const container = `${prefix}-${randomUUID()}`;
    const sql = (text) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], text);
    let created = false;
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
        created = true;
        let ready = false;
        for (let i = 0; i < 120; i += 1) {
            try {
                if (await docker(['exec', container, 'cat', '/proc/1/comm']) === 'postgres') {
                    await docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
                    ready = true;
                    break;
                }
            } catch { /* still starting */ }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!ready) throw new Error('PostgreSQL did not start');
        return await body(sql);
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
}

// A JavaScript value as an SQL literal of unknown type: the statement's context types it.
function literal(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return `'${text.replace(/'/g, "''")}'`;
}

/**
 * Row access on top of `sql` for the suites written as db.query(text, params).rows: $n parameters
 * become literals, rows come back through jsonb (jsonb columns as objects, timestamps as ISO
 * strings, numbers as numbers). `session` is SQL run first in the same session, such as the JWT
 * claims of a client.
 */
export function rowsClient(sql) {
    return {
        exec: (text) => sql(text),
        async query(text, params = [], session = '') {
            const statement = text.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1])).trim().replace(/;$/, '');
            let wrapped;
            if (!/^(insert|update|delete)\b/i.test(statement)) wrapped = `select coalesce(jsonb_agg(q), '[]') from (${statement}) q`;
            else if (/\breturning\b/i.test(statement)) wrapped = `with q as (${statement}) select coalesce(jsonb_agg(q), '[]') from q`;
            else wrapped = `${statement}; select '[]'`;
            const output = await sql(`${session}\n${wrapped};`);
            return { rows: JSON.parse(output.split(/\r?\n/).pop()) };
        },
    };
}
