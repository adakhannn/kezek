#!/usr/bin/env node
// Local load test for Kezek (R25-28). Runs ONLY against a local stack: local Supabase
// (`pnpm db:start:check` + `node scripts/e2e-seed.mjs`) and a local web server. Every URL is checked
// by guard.mjs before the first request; *.vercel.app, *.supabase.co, kezek.kg, the production project
// ref and any non-loopback host are refused. There is no override.
//
//   node scripts/load/run.mjs --base-url http://localhost:3100            # all scenarios, ramp 10/50/100
//   node scripts/load/run.mjs --scenarios slots,booking --stages 10,50 --stage-seconds 30
//   node scripts/load/run.mjs --dry-run                                    # check targets and config only
//   node scripts/load/run.mjs --cleanup-only <runId>                       # cancel bookings of a run
//
// Scenarios: home (GET /), catalogue (GET /?q=...), business (GET /b/<slug>), slots (the booking page's
// RPC get_free_slots_service_day_v2 on the local PostgREST), booking (POST /api/quick-book-guest, the
// guest booking command, with test names «LOADTEST <runId>»). Each scenario runs through each stage
// (closed model: N virtual users, no think time). Results: markdown + JSON in scripts/load/results/.
//
// Booking cleanup and the double-booking check use `docker exec supabase_db_<project_id> psql`, as the
// e2e seed does; created bookings are cancelled (not deleted) after every booking stage.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertLocalTarget, LoadTargetError, localUrl } from './guard.mjs';
import { createCell, formatMarkdown, record } from './stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ENV_FILE = path.join(ROOT, 'apps', 'web', 'e2e', '.e2e.env');
const ALL_SCENARIOS = ['home', 'catalogue', 'business', 'slots', 'booking'];
/** «E2E Стрижка» from scripts/e2e-seed.mjs (IDS.serviceHaircut); the seed module runs on import, so it is copied. */
const E2E_SERVICE_HAIRCUT = 'e2e00000-0000-4000-8000-000000000021';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_ID = /^[0-9A-Za-z-]{4,40}$/;
const BUSINESS_TZ = 'Asia/Bishkek';

const HELP = `Usage: node scripts/load/run.mjs [options]
  --base-url <url>        local web (default $LOAD_BASE_URL or http://localhost:3100)
  --seed-env <path>       KEY=VALUE file from e2e-seed (default apps/web/e2e/.e2e.env)
  --supabase-url <url>    local Supabase API (default NEXT_PUBLIC_SUPABASE_URL from env/env file)
  --scenarios <list>      ${ALL_SCENARIOS.join(',')} (default: all)
  --stages <list>         concurrent virtual users per stage (default 10,50,100)
  --stage-seconds <n>     duration of each stage (default 20)
  --timeout-ms <n>        per-request timeout (default 30000)
  --days <n>              booking/slots look-ahead in days (default 14)
  --query <text>          catalogue search text (default "E2E")
  --out <file.md>         summary path (default scripts/load/results/load-<runId>.md)
  --workdir <dir>         supabase --workdir of the stack (as in e2e-seed)
  --no-cleanup            keep bookings created by the run (not recommended)
  --cleanup-only <runId>  only cancel the bookings of an earlier run
  --dry-run               validate targets/config and print the plan; no requests
`;

export function parseArgs(argv) {
    const args = { cleanup: true, dryRun: false };
    const take = (i) => {
        if (i + 1 >= argv.length) throw new Error(`Missing value for ${argv[i]}`);
        return argv[i + 1];
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        switch (a) {
            case '--base-url': args.baseUrl = take(i); i += 1; break;
            case '--seed-env': args.envFile = take(i); i += 1; break;
            case '--supabase-url': args.supabaseUrl = take(i); i += 1; break;
            case '--scenarios': args.scenarios = take(i).split(',').map((s) => s.trim()).filter(Boolean); i += 1; break;
            case '--stages': args.stages = take(i).split(',').map(Number); i += 1; break;
            case '--stage-seconds': args.stageSeconds = Number(take(i)); i += 1; break;
            case '--timeout-ms': args.timeoutMs = Number(take(i)); i += 1; break;
            case '--days': args.days = Number(take(i)); i += 1; break;
            case '--query': args.query = take(i); i += 1; break;
            case '--out': args.out = take(i); i += 1; break;
            case '--workdir': args.workdir = take(i); i += 1; break;
            case '--no-cleanup': args.cleanup = false; break;
            case '--cleanup-only': args.cleanupOnly = take(i); i += 1; break;
            case '--dry-run': args.dryRun = true; break;
            case '--help': case '-h': args.help = true; break;
            default: throw new Error(`Unknown argument: ${a}`);
        }
    }
    return args;
}

export function readEnvFile(file) {
    if (!file || !existsSync(file)) return {};
    const values = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m) values[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
    return values;
}

/** Builds and validates the run configuration. Throws LoadTargetError for any non-local target. */
export function resolveConfig(args, env = process.env) {
    const fileEnv = readEnvFile(args.envFile ?? DEFAULT_ENV_FILE);
    const pick = (key) => env[key] || fileEnv[key] || '';
    const scenarios = args.scenarios ?? ALL_SCENARIOS;
    for (const s of scenarios) if (!ALL_SCENARIOS.includes(s)) throw new Error(`Unknown scenario: ${s}`);
    const stages = args.stages ?? [10, 50, 100];
    if (!stages.length || stages.some((n) => !Number.isInteger(n) || n < 1 || n > 1000)) {
        throw new Error('--stages must be integers between 1 and 1000');
    }
    const stageSeconds = args.stageSeconds ?? 20;
    if (!(stageSeconds > 0 && stageSeconds <= 3600)) throw new Error('--stage-seconds must be in (0, 3600]');

    const baseUrl = assertLocalTarget(args.baseUrl || env.LOAD_BASE_URL || 'http://localhost:3100', 'web base URL').origin;
    const needsSupabase = scenarios.includes('slots') || scenarios.includes('booking');
    const supabaseRaw = args.supabaseUrl || pick('NEXT_PUBLIC_SUPABASE_URL');
    let supabaseUrl = null;
    if (needsSupabase || supabaseRaw) supabaseUrl = assertLocalTarget(supabaseRaw, 'Supabase URL').origin;

    const config = {
        baseUrl, supabaseUrl, scenarios, stages, stageSeconds,
        timeoutMs: args.timeoutMs ?? 30000,
        days: args.days ?? 14,
        query: args.query ?? 'E2E',
        anonKey: pick('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        slug: pick('E2E_TEST_BUSINESS_SLUG') || 'e2e-salon',
        bizId: pick('E2E_TEST_BUSINESS_ID'),
        serviceId: pick('LOAD_SERVICE_ID') || E2E_SERVICE_HAIRCUT,
        cleanup: args.cleanup !== false,
        workdir: args.workdir ?? null,
        runId: args.runId ?? `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${randomBytes(2).toString('hex')}`,
    };
    if (needsSupabase) {
        if (!config.anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing (run e2e-seed into the env file).');
        if (!UUID.test(config.bizId)) throw new Error('E2E_TEST_BUSINESS_ID is missing or not a uuid.');
        if (!UUID.test(config.serviceId)) throw new Error('LOAD_SERVICE_ID is not a uuid.');
    }
    if (!RUN_ID.test(config.runId)) throw new Error('Invalid run id.');
    config.out = args.out ?? path.join(ROOT, 'scripts', 'load', 'results', `load-${config.runId}.md`);
    return config;
}

// ---------------------------------------------------------------- requests

async function timedFetch(url, init, timeoutMs) {
    const started = performance.now();
    try {
        // redirect: 'manual' — a local server must not be able to send the load elsewhere.
        const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
        const body = await res.text();
        return { ms: performance.now() - started, status: res.status, body };
    } catch (error) {
        return { ms: performance.now() - started, status: null, body: '', error };
    }
}

function businessDay(offsetDays) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(Date.now() + offsetDays * 86_400_000));
}

function slotsRequest(config, day) {
    return {
        url: localUrl(config.supabaseUrl, '/rest/v1/rpc/get_free_slots_service_day_v2'),
        init: {
            method: 'POST',
            headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                p_biz_id: config.bizId, p_service_id: config.serviceId, p_day: day,
                p_per_staff: 400, p_step_min: 15, p_staff_id: null,
            }),
        },
    };
}

const pageKind = (r) => (r.status === null ? 'network' : r.status < 400 ? 'ok' : r.status === 429 ? 'rate_limited' : 'error');

function apiKind(r) {
    if (r.status === null) return 'network';
    if (r.status >= 200 && r.status < 300) return 'ok';
    if (r.status === 429) return 'rate_limited';
    if (r.status === 503) {
        // The limiter's 503 carries retryAfter; a booking 503 (command failed) does not.
        try { if (JSON.parse(r.body)?.retryAfter !== undefined) return 'rate_limited'; } catch { /* plain error */ }
    }
    return 'error';
}

/** Shared pool of free slots for the booking scenario; each slot is offered once. */
export class SlotPool {
    constructor(config) { this.config = config; this.slots = []; this.refilling = null; this.exhausted = false; }
    async refill() {
        this.refilling ??= (async () => {
            const minStart = Date.now() + 60 * 60_000;
            const found = [];
            for (let d = 1; d <= this.config.days; d += 1) {
                const { url, init } = slotsRequest(this.config, businessDay(d));
                const r = await timedFetch(url, init, this.config.timeoutMs);
                if (r.status !== 200) continue;
                try {
                    for (const s of JSON.parse(r.body)) if (Date.parse(s.start_at) >= minStart) found.push(s);
                } catch { /* ignore a bad page */ }
            }
            for (let i = found.length - 1; i > 0; i -= 1) {
                const j = randomInt(i + 1);
                [found[i], found[j]] = [found[j], found[i]];
            }
            this.slots = found;
            this.exhausted = found.length === 0;
        })().finally(() => { this.refilling = null; });
        return this.refilling;
    }
    async take() {
        // Loop: other workers may drain a refill before this one gets a slot.
        while (!this.slots.length) {
            if (this.exhausted) return null;
            await this.refill();
        }
        return this.slots.pop();
    }
}

const randomClientIp = () => `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`;

/** One iteration of a scenario: returns { ms, status, kind } or null when there is nothing left to do. */
export function scenarioStep(name, config, ctx) {
    const page = (p) => async () => {
        const r = await timedFetch(localUrl(config.baseUrl, p), { headers: { 'Accept-Language': 'ru' } }, config.timeoutMs);
        return { ...r, kind: pageKind(r) };
    };
    switch (name) {
        case 'home': return page('/');
        case 'catalogue': return page(`/?q=${encodeURIComponent(config.query)}`);
        case 'business': return page(`/b/${encodeURIComponent(config.slug)}`);
        case 'slots': return async () => {
            const { url, init } = slotsRequest(config, businessDay(1 + randomInt(config.days)));
            const r = await timedFetch(url, init, config.timeoutMs);
            return { ...r, kind: apiKind(r) };
        };
        case 'booking': return async () => {
            const slot = await ctx.pool.take();
            if (!slot) return null;
            const r = await timedFetch(localUrl(config.baseUrl, '/api/quick-book-guest'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', 'Accept-Language': 'ru',
                    'Idempotency-Key': randomUUID(),
                    'X-Booking-Client-Token': randomBytes(32).toString('hex'),
                    // One address per request: the local limiter reads it only with
                    // RATE_LIMIT_TRUSTED_IP_HEADER=x-forwarded-for (see docs/OPERATIONS.md).
                    'X-Forwarded-For': randomClientIp(),
                },
                body: JSON.stringify({
                    biz_id: config.bizId, branch_id: slot.branch_id, service_id: config.serviceId,
                    staff_id: slot.staff_id, start_at: slot.start_at,
                    client_name: `LOADTEST ${config.runId}`,
                    client_phone: `+99670${String(randomInt(10_000_000)).padStart(7, '0')}`,
                }),
            }, config.timeoutMs);
            const kind = r.status === 409 ? 'conflict' : apiKind(r);
            return { ...r, kind };
        };
        default: throw new Error(`Unknown scenario: ${name}`);
    }
}

/** Runs one closed-model stage: `vus` workers loop until the stage time is over. */
export async function runCell(name, vus, config, ctx) {
    const cell = createCell(name, vus);
    const step = scenarioStep(name, config, ctx);
    if (name !== 'booking') {
        // Warm-up (not recorded): `next dev` compiles a route on its first request.
        for (let i = 0; i < 3; i += 1) await step();
    }
    const started = performance.now();
    const deadline = started + config.stageSeconds * 1000;
    let stoppedEarly = false;
    let lastEnd = started;
    const worker = async () => {
        while (performance.now() < deadline) {
            const r = await step();
            if (!r) { stoppedEarly = true; return; }
            record(cell, r);
            lastEnd = Math.max(lastEnd, performance.now());
        }
    };
    await Promise.all(Array.from({ length: vus }, worker));
    cell.durationMs = Math.max(1, lastEnd - started);
    if (stoppedEarly) cell.notes.push('свободные слоты закончились до конца ступени (увеличьте --days или сбросьте стек).');
    const statuses = Object.keys(cell.statuses);
    if (cell.rateLimited > cell.latencies.length / 2) {
        cell.notes.push('больше половины ответов 429/503 limiter: локальный web запущен без RATE_LIMIT_TRUSTED_IP_HEADER=x-forwarded-for или как `next start` без Upstash.');
    }
    if (statuses.includes('ERR')) cell.notes.push('были сетевые ошибки/таймауты (сервер не отвечает или перегружен).');
    return cell;
}

// ---------------------------------------------------------------- local database (docker exec psql)

function readProjectId(workdir) {
    const file = path.join(workdir ? path.resolve(workdir) : ROOT, 'supabase', 'config.toml');
    const m = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(file, 'utf8'));
    if (!m || !/^[A-Za-z0-9_-]+$/.test(m[1])) throw new Error(`project_id not found in ${file}`);
    return m[1];
}

function psql(config, sql) {
    const container = `supabase_db_${readProjectId(config.workdir)}`;
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
        input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
}

function runRowsSql(config, runId) {
    if (!UUID.test(config.bizId) || !RUN_ID.test(runId)) throw new Error('Invalid business id or run id.');
    return { biz: config.bizId, name: `LOADTEST ${runId}` };
}

/** Counts the run's bookings and active overlaps with any other active booking of the same master. */
export function checkIntegrity(config, runId) {
    const { biz, name } = runRowsSql(config, runId);
    const out = psql(config, `
select count(*) from public.bookings where biz_id = '${biz}' and client_name = '${name}';
select count(*) from public.bookings a
  join public.bookings b on b.staff_id = a.staff_id and b.id <> a.id and b.status <> 'cancelled'
   and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at)
 where a.biz_id = '${biz}' and a.client_name = '${name}' and a.status <> 'cancelled';
`).split(/\r?\n/);
    return { created: Number(out[0]), overlaps: Number(out[1]) };
}

/** Cancels (does not delete) the run's active bookings; returns how many were cancelled. */
export function cancelRunBookings(config, runId) {
    const { biz, name } = runRowsSql(config, runId);
    return Number(psql(config, `
with u as (
  update public.bookings set status = 'cancelled', expires_at = null
   where biz_id = '${biz}' and client_name = '${name}' and status <> 'cancelled'
  returning 1)
select count(*) from u;
`));
}

// ---------------------------------------------------------------- run

function gitRevision() {
    try {
        const rev = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() ? ' (+ незакоммиченные изменения)' : '';
        return rev + dirty;
    } catch { return 'unknown'; }
}

export async function runLoad(config, { log = (m) => process.stderr.write(`[load] ${m}\n`), db = { checkIntegrity, cancelRunBookings } } = {}) {
    const ctx = { pool: config.scenarios.includes('booking') ? new SlotPool(config) : null };
    const cells = [];
    const integrity = { created: 0, overlaps: 0, note: null };
    const cleanup = { cancelled: 0, note: null };
    let dbOk = config.scenarios.includes('booking');
    for (const name of config.scenarios) {
        for (const vus of config.stages) {
            log(`${name} × ${vus} VU for ${config.stageSeconds}s`);
            if (name === 'booking') { ctx.pool.slots = []; ctx.pool.exhausted = false; }
            const cell = await runCell(name, vus, config, ctx);
            cells.push(cell);
            if (name === 'booking' && dbOk) {
                try {
                    const check = db.checkIntegrity(config, config.runId);
                    integrity.overlaps += check.overlaps;
                    integrity.created = check.created;
                    if (config.cleanup) cleanup.cancelled += db.cancelRunBookings(config, config.runId);
                } catch (error) {
                    dbOk = false;
                    integrity.overlaps = null;
                    integrity.created = undefined;
                    integrity.note = `не проверено: локальная БД через docker недоступна (${String(error.message).split('\n')[0]}).`;
                }
            }
        }
    }
    const meta = {
        runId: config.runId,
        'Дата': new Date().toISOString(),
        'Web': config.baseUrl,
        'Supabase': config.supabaseUrl ?? '—',
        'Ревизия': gitRevision(),
        'Машина': `${os.cpus().length} CPU, ${Math.round(os.totalmem() / 2 ** 30)} GiB, ${process.platform}, node ${process.version}`,
        'Ступени': `${config.stages.join(' → ')} VU по ${config.stageSeconds} с, без пауз`,
    };
    const run = { meta, cells, integrity: config.scenarios.includes('booking') ? integrity : null, cleanup: null };
    if (config.scenarios.includes('booking')) {
        run.cleanup = {
            note: !config.cleanup ? `очистка отключена (--no-cleanup); отменить позже: node scripts/load/run.mjs --cleanup-only ${config.runId}`
                : dbOk ? `отменено записей прогона: ${cleanup.cancelled} (статус cancelled, имя «LOADTEST ${config.runId}»).`
                : `не выполнена: docker недоступен; после запуска стека: node scripts/load/run.mjs --cleanup-only ${config.runId}`,
        };
    }
    return run;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { process.stdout.write(HELP); return; }
    if (args.cleanupOnly) {
        const config = resolveConfig({ ...args, scenarios: ['booking'], runId: args.cleanupOnly });
        const n = cancelRunBookings(config, args.cleanupOnly);
        process.stdout.write(`cancelled ${n} bookings of run ${args.cleanupOnly}\n`);
        return;
    }
    const config = resolveConfig(args);
    if (args.dryRun) {
        const { anonKey, ...shown } = config;
        process.stdout.write(`${JSON.stringify({ ...shown, anonKey: anonKey ? '<set>' : '<missing>' }, null, 2)}\n`);
        process.stdout.write('dry run: targets are local; no requests sent.\n');
        return;
    }
    const run = await runLoad(config);
    const markdown = formatMarkdown(run);
    mkdirSync(path.dirname(config.out), { recursive: true });
    writeFileSync(config.out, markdown);
    writeFileSync(config.out.replace(/\.md$/, '') + '.json', JSON.stringify({ meta: run.meta, integrity: run.integrity, cleanup: run.cleanup,
        cells: run.cells.map(({ latencies, ...rest }) => ({ ...rest, samples: latencies.length })) }, null, 2));
    process.stdout.write(markdown);
    process.stderr.write(`[load] summary: ${config.out}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        process.stderr.write(`[load] ${error instanceof LoadTargetError ? '' : 'error: '}${error.message}\n`);
        process.exit(error instanceof LoadTargetError ? 2 : 1);
    });
}
