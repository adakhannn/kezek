// Lints every PL/pgSQL function of the public schema with plpgsql_check (`supabase db lint`) on a
// running local stack (baseline + migrations) and fails on any error that is not a known,
// documented exception. Such errors only surface at call time: members_of_biz (42804) and
// get_api_metrics_stats (42803) failed on every call in production before they were found.
//
//   node scripts/check-sql-functions.mjs [--workdir <dir>]
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const workdirIndex = args.indexOf('--workdir');
const workdir = workdirIndex >= 0 ? path.resolve(args[workdirIndex + 1]) : root;

// Each exception names the function and the exact error; any other error, even in the same
// function, fails the check.
const knownErrors = [
    // PostGIS ships these helpers in public; they are extension code, not ours.
    { fn: 'public.addauth', message: 'temp_lock_have_table' },
    { fn: 'public.lockrow', message: 'authorization_table' },
    { fn: 'public.populate_geometry_columns', message: 'record "gc" is not assigned yet' },
    { fn: 'public.postgis_full_version', message: 'postgis_gdal_version' },
    { fn: 'public.st_findextent', message: 'record "myrec" is not assigned yet' },
    // Dead project functions without callers (docs/ENGINEERING_FINDINGS.md, ENG-61).
    { fn: 'public.apply_promotion_to_booking_impl_20261109', message: 'must appear in the GROUP BY clause' },
    { fn: 'public.create_internal_booking', message: 'non-DEFAULT value into column "time_range"' },
    { fn: 'public.grant_role', message: 'has_role(unknown, unknown) is not unique' },
    { fn: 'public.revoke_role', message: 'has_role(unknown, unknown) is not unique' },
    { fn: 'public.purge_user', message: 'relation "public.invitations" does not exist' },
];

const cli = path.join(root, 'node_modules/.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const result = spawnSync(cli, ['db', 'lint', '--level', 'error', '--schema', 'public', '--workdir', workdir], {
    cwd: workdir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
    windowsHide: true,
});
const output = result.stdout ?? '';
const start = output.indexOf('[');
const end = output.lastIndexOf(']');
if (result.status !== 0 && start < 0) {
    process.stderr.write(result.stderr || 'supabase db lint failed\n');
    process.exit(result.status || 1);
}
const report = start >= 0 && end > start ? JSON.parse(output.slice(start, end + 1)) : [];

const unexpected = [];
for (const entry of report) {
    for (const issue of entry.issues ?? []) {
        const known = knownErrors.some((rule) => rule.fn === entry.function && String(issue.message).includes(rule.message));
        if (!known) unexpected.push(`${entry.function}: ${issue.message}${issue.sqlState ? ` (${issue.sqlState})` : ''}`);
    }
}

if (unexpected.length > 0) {
    console.error(`plpgsql_check found ${unexpected.length} unexpected error(s):`);
    for (const line of unexpected) console.error(`- ${line}`);
    process.exit(1);
}
console.log(`SQL functions checked: no unexpected plpgsql_check errors (${knownErrors.length} documented exceptions).`);
