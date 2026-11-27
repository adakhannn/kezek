// Metrics and the markdown summary of the local load test (R25-28). Pure functions, no I/O.

/**
 * Proposed SLOs for Osh scale (see docs/OPERATIONS.md, «Нагрузочный тест (локально)»).
 * They apply to the stages with at most `sloVus` virtual users; stages above it are stress
 * stages (reported, not judged). Error rate excludes expected booking conflicts (409 slot taken).
 */
export const SLO = {
    home: { title: 'Главная', p95Ms: 800, errorPct: 1 },
    catalogue: { title: 'Каталог (поиск)', p95Ms: 800, errorPct: 1 },
    business: { title: 'Страница бизнеса', p95Ms: 800, errorPct: 1 },
    slots: { title: 'Свободные слоты (RPC)', p95Ms: 300, errorPct: 1 },
    booking: { title: 'Создание записи (гость)', p95Ms: 1500, errorPct: 1 },
};
export const SLO_MAX_VUS = 50;

/** Nearest-rank percentile of an ascending array; null for an empty one. */
export function percentile(sorted, p) {
    if (!sorted.length) return null;
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** Empty accumulator for one (scenario, stage) cell. */
export function createCell(scenario, vus) {
    return {
        scenario, vus, startedAt: 0, durationMs: 0,
        latencies: [], statuses: {}, ok: 0, conflicts: 0, rateLimited: 0, failed: 0, networkErrors: 0,
        notes: [],
    };
}

/**
 * Records one request outcome.
 * kind: 'ok' | 'conflict' (expected business outcome) | 'rate_limited' | 'error' | 'network'
 */
export function record(cell, { ms, status, kind }) {
    cell.latencies.push(ms);
    const key = status === undefined || status === null ? 'ERR' : String(status);
    cell.statuses[key] = (cell.statuses[key] ?? 0) + 1;
    if (kind === 'ok') cell.ok += 1;
    else if (kind === 'conflict') cell.conflicts += 1;
    else if (kind === 'rate_limited') cell.rateLimited += 1;
    else if (kind === 'network') cell.networkErrors += 1;
    else cell.failed += 1;
}

export function summarizeCell(cell) {
    const sorted = [...cell.latencies].sort((a, b) => a - b);
    const total = sorted.length;
    const errors = cell.failed + cell.networkErrors + cell.rateLimited;
    const seconds = cell.durationMs / 1000;
    const slo = SLO[cell.scenario];
    const p95 = percentile(sorted, 95);
    const errorPct = total ? (errors / total) * 100 : 0;
    let verdict = '—';
    if (!total) verdict = 'нет данных';
    else if (slo && cell.vus <= SLO_MAX_VUS) verdict = p95 <= slo.p95Ms && errorPct <= slo.errorPct ? 'OK' : 'FAIL';
    else if (slo) verdict = 'стресс';
    return {
        scenario: cell.scenario, vus: cell.vus, total, ok: cell.ok, conflicts: cell.conflicts,
        rateLimited: cell.rateLimited, errors, errorPct,
        rps: seconds > 0 ? total / seconds : 0,
        p50: percentile(sorted, 50), p95, p99: percentile(sorted, 99), max: total ? sorted[total - 1] : null,
        statuses: cell.statuses, verdict, notes: cell.notes,
    };
}

const fmtMs = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}`);
const fmtNum = (v, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : '—');
const fmtStatuses = (s) => Object.entries(s).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}×${v}`).join(', ') || '—';

/**
 * Markdown summary of a run.
 * @param {{ meta: Record<string, string>, cells: ReturnType<typeof createCell>[], integrity?: object|null, cleanup?: object|null }} run
 */
export function formatMarkdown(run) {
    const rows = run.cells.map(summarizeCell);
    const lines = [];
    lines.push(`# Нагрузочный тест (локально) — ${run.meta.runId ?? ''}`.trimEnd(), '');
    lines.push('| Параметр | Значение |', '| --- | --- |');
    for (const [key, value] of Object.entries(run.meta)) lines.push(`| ${key} | ${String(value).replace(/\|/g, '\\|')} |`);
    lines.push('');
    lines.push('| Сценарий | VU | Запросов | RPS | p50, мс | p95, мс | p99, мс | max, мс | Ошибки, % | 429/503 | Конфликты 409 | Коды | SLO |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
    for (const r of rows) {
        const title = SLO[r.scenario]?.title ?? r.scenario;
        lines.push(`| ${title} | ${r.vus} | ${r.total} | ${fmtNum(r.rps)} | ${fmtMs(r.p50)} | ${fmtMs(r.p95)} | ${fmtMs(r.p99)} | ${fmtMs(r.max)} | ${fmtNum(r.errorPct, 2)} | ${r.rateLimited} | ${r.conflicts} | ${fmtStatuses(r.statuses)} | ${r.verdict} |`);
    }
    lines.push('');
    lines.push(`SLO проверяется на ступенях до ${SLO_MAX_VUS} VU; выше — стресс (только наблюдение). Ошибки = 4xx/5xx кроме ожидаемого 409 «слот занят», плюс сетевые ошибки и таймауты; 429/503 входят в ошибки и показаны отдельно.`);
    const notes = rows.flatMap((r) => r.notes.map((n) => `- ${SLO[r.scenario]?.title ?? r.scenario}, ${r.vus} VU: ${n}`));
    if (notes.length) lines.push('', '## Замечания', '', ...notes);
    if (run.integrity) {
        lines.push('', '## Целостность записей', '');
        lines.push(`- Пересекающихся активных записей одного мастера: **${run.integrity.overlaps ?? 'не проверено'}** (ожидается 0).`);
        if (run.integrity.created !== undefined) lines.push(`- Записей, созданных прогоном: ${run.integrity.created}.`);
        if (run.integrity.note) lines.push(`- ${run.integrity.note}`);
    }
    if (run.cleanup) {
        lines.push('', '## Очистка', '', `- ${run.cleanup.note}`);
    }
    lines.push('');
    return lines.join('\n');
}
