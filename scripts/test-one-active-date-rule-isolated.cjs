// Integration fixture for 20261118170000_one_active_date_rule. A disposable PostgreSQL with the
// production staff_schedule_rules table (from the baseline) shows two active rules for one day,
// checks that the migration refuses to run over duplicates, then applies it and checks what the
// index allows: one active date rule per staff member and day, inactive history, other staff,
// other kinds, and upserts by id from the legacy editor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
function extract(file, start, end) {
    const text = read(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} not found in ${file}`);
    const to = text.indexOf(end, from);
    assert.ok(to > from, `${end} not found after ${start}`);
    return text.slice(from, to + end.length);
}
const baseline = '20261009110000_prod_baseline.sql';
const migration = '20261118170000_one_active_date_rule.sql';

const container = `kezek-one-date-rule-${randomUUID()}`;
const docker = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', (data) => { err += data; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `exit ${code}`))));
    child.stdin.end(input);
});
const sql = (input) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);

const [biz, branch, staffA, staffB] = Array.from({ length: 4 }, () => randomUUID());
const rule = (staff, date, active = true) =>
    `insert into public.staff_schedule_rules(biz_id, staff_id, kind, date_on, branch_id, intervals, is_active)
     values ('${biz}', '${staff}', 'date', '${date}', '${branch}', '[{"start":"10:00","end":"19:00"}]', ${active})`;
let created = false;

(async () => {
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
            await new Promise((r) => setTimeout(r, 500));
        }
        assert.ok(ready, 'PostgreSQL did not start');

        await sql([
            extract(baseline, 'CREATE TYPE "public"."schedule_rule_kind"', ');\n'),
            extract(baseline, 'CREATE TABLE IF NOT EXISTS "public"."staff_schedule_rules"', '\n);\n'),
            'alter table public.staff_schedule_rules add primary key (id);',
        ].join('\n'));

        // Before: nothing prevents two active rules for one day.
        await sql(`${rule(staffA, '2026-11-20')}; ${rule(staffA, '2026-11-20')};`);
        assert.equal(await sql(`select count(*) from public.staff_schedule_rules where staff_id = '${staffA}' and is_active`), '2', 'FE-02: duplicates');

        // The migration refuses to run over duplicates and leaves the data alone.
        await assert.rejects(sql(read(migration)), /FE-02: 1 staff\/date pair\(s\) have several active date rules/);
        assert.equal(await sql(`select count(*) from pg_indexes where indexname = 'staff_schedule_rules_one_active_date'`), '0');

        await sql(`update public.staff_schedule_rules set is_active = false
                    where id = (select id from public.staff_schedule_rules where staff_id = '${staffA}' order by created_at, id limit 1)`);
        await sql(read(migration));

        // After: one active date rule per staff member and day.
        await assert.rejects(sql(rule(staffA, '2026-11-20')), /staff_schedule_rules_one_active_date/);
        await sql(`${rule(staffA, '2026-11-20', false)}; ${rule(staffB, '2026-11-20')}; ${rule(staffA, '2026-11-21')};`);
        await sql(`insert into public.staff_schedule_rules(biz_id, staff_id, kind, day_of_week, branch_id) values ('${biz}', '${staffA}', 'weekly', 5, '${branch}'), ('${biz}', '${staffA}', 'weekly', 5, '${branch}')`);

        // The editor's "apply branch hours" upsert: existing rows by id are updated, a new row for a
        // day that already has an active rule is refused.
        const existing = await sql(`select id from public.staff_schedule_rules where staff_id = '${staffA}' and date_on = '2026-11-21'`);
        await sql(`insert into public.staff_schedule_rules(id, biz_id, staff_id, kind, date_on, branch_id, intervals)
                   values ('${existing}', '${biz}', '${staffA}', 'date', '2026-11-21', '${branch}', '[]')
                   on conflict (id) do update set intervals = excluded.intervals`);
        assert.equal(await sql(`select intervals::text from public.staff_schedule_rules where id = '${existing}'`), '[]');
        await assert.rejects(sql(`insert into public.staff_schedule_rules(biz_id, staff_id, kind, date_on, branch_id)
                   values ('${biz}', '${staffA}', 'date', '2026-11-21', '${branch}')
                   on conflict (id) do update set intervals = excluded.intervals`), /staff_schedule_rules_one_active_date/);

        // Re-running is harmless.
        await sql(read(migration));
        assert.equal(await sql(`select count(*) from public.staff_schedule_rules where kind = 'date' and is_active`), '3');

        await assertLiveFunctions(sql, { suite: 'test-one-active-date-rule-isolated.cjs' });
        console.log('one active date rule: ok');
    } finally {
        if (created) await docker(['rm', '--force', container]).catch(() => undefined);
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
