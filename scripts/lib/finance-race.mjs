// Two real sessions of a disposable PostgreSQL for the finance suites (CI-01). The winner takes its
// locks in an open transaction; the server itself then watches pg_stat_activity and commits as soon
// as the loser waits on a lock, so the loser waits milliseconds. A fixed pg_sleep, or polling with one
// docker exec per check, keeps the loser waiting for seconds, while the shipped Close gives up after
// lock_timeout=2s (20261110114000).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

function psql(container) {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true });
    // A session that already failed closes its stdin; its exit code and stderr report the failure.
    child.stdin.on('error', () => {});
    return child;
}

function session(container, input) {
    return new Promise((resolve, reject) => {
        const child = psql(container);
        let out = '';
        let err = '';
        child.stdout.on('data', (data) => { out += data; });
        child.stderr.on('data', (data) => { err += data; });
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `exit ${code}`))));
        child.stdin.end(input);
    });
}

/**
 * Runs `winner` inside an open transaction (after `identity`), then `loser` in a second session
 * (after `loserIdentity`). The winner commits once the loser waits on one of its locks, after
 * `holdSeconds` more when the loser should outlast its lock_timeout. The loser must fail with
 * `expected`. Resolves with the winner's output.
 */
export async function race(container, { winner, loser, expected, identity = '', loserIdentity = identity, holdSeconds = 0 }) {
    const marker = `RACE_LOCKS_HELD_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    const application = `finance_race_${marker.slice(16)}`;
    const child = psql(container);
    let out = '';
    let err = '';
    let markReady;
    const ready = new Promise((resolve) => { markReady = resolve; });
    child.stdout.on('data', (data) => { out += data; if (out.includes(marker)) markReady(); });
    child.stderr.on('data', (data) => { err += data; });
    const first = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || out || `exit ${code}`))));
    });
    first.catch(() => {});
    let timer;
    try {
        child.stdin.write(`${identity} begin; set local statement_timeout='60s'; set local idle_in_transaction_session_timeout='60s'; ${winner};\n\\echo ${marker}\n`);
        await Promise.race([
            ready,
            first.then(() => { throw new Error('Winner exited before taking its locks'); }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Winner did not take its locks')), 20000); }),
        ]);
        clearTimeout(timer);
        const second = session(container, `${loserIdentity}\nset application_name='${application}'; set statement_timeout='30s'; ${loser};`);
        second.catch(() => {});
        // A client role does not see the wait events of other sessions, so the check runs as the
        // session user; pg_stat_activity is a per-transaction snapshot and is cleared on each check.
        child.stdin.end(`reset role;
do $race$ begin
    for i in 1..2000 loop
        perform pg_stat_clear_snapshot();
        if exists(select 1 from pg_stat_activity where application_name='${application}' and wait_event_type='Lock') then
            perform pg_sleep(${Number(holdSeconds)});
            return;
        end if;
        perform pg_sleep(0.01);
    end loop;
    raise exception 'RACE_LOSER_NEVER_WAITED: the loser must wait on a lock of the winner';
end $race$;
commit;
`);
        try {
            await first;
        } catch (error) {
            const outcome = await second.then((value) => `succeeded: ${value}`, (failure) => `failed: ${failure.message}`);
            throw new Error(`${error.message}\nLoser ${outcome}`);
        }
        await assert.rejects(second, expected);
        return out.slice(0, out.indexOf(marker)).trim();
    } finally {
        clearTimeout(timer);
        if (!child.stdin.writableEnded) child.stdin.end('rollback;\n');
        await first.catch(() => {});
    }
}
