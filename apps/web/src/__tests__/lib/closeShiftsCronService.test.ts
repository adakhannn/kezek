import { runCloseShiftsCron, CLOSE_SHIFTS_BATCH_SIZE, CLOSE_SHIFTS_BUDGET_MS } from '@/lib/closeShiftsCronService';
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));
const shift = { id: 'shift-1', staff_id: 'staff-1', biz_id: 'biz-1', shift_date: '2026-10-12', status: 'open', opened_at: '2026-10-12T03:00:00Z', ledger_revision: 4 };
const items = [{ id: 'item-1', service_amount: 500, consumables_amount: 100, booking_id: 'booking-1' }];
const snapshot = { shift, items, staff: { percent_master: 60, percent_salon: 40, hourly_rate: 100 }, timezone: 'Asia/Bishkek', dayStart: '2026-10-11T18:00Z', dayHours: 24, closeBoundary: '2026-10-12T18:00Z' };
function setup(options: { rows?: unknown[]; hasMore?: boolean; claimError?: unknown; closeError?: unknown; configurationErrors?: string[] } = {}) {
    const db = { from: jest.fn(), rpc: jest.fn(async (name: string) => name === 'claim_overdue_staff_shifts'
        ? { data: { rows: options.rows ?? [snapshot], hasMore: options.hasMore ?? false, configurationErrors: options.configurationErrors ?? [] }, error: options.claimError ?? null }
        : { data: { ok: true, action: 'closed' }, error: options.closeError ?? null }) };
    return db;
}
const run = (db: ReturnType<typeof setup>, clock?: () => number) => runCloseShiftsCron({ supabase: db as never, now: new Date('2026-10-20T01:00:00Z'), clock });
const closeCalls = (db: ReturnType<typeof setup>) => db.rpc.mock.calls.filter(([name]) => name === 'close_staff_shift_command');
test('claims a bounded complete batch and closes at the business-local end of the shift day', async () => {
    const db = setup(); expect(await run(db)).toMatchObject({ ok: true, data: { closed: 1, total: 1, attempted: 1, pending: 0, hasMore: false } });
    expect(db.rpc).toHaveBeenCalledWith('claim_overdue_staff_shifts', expect.objectContaining({ p_limit: CLOSE_SHIFTS_BATCH_SIZE, p_now: '2026-10-20T01:00:00.000Z' }));
    expect(db.rpc).toHaveBeenCalledWith('close_staff_shift_command', expect.objectContaining({ p_actor_id: null, p_expected_revision: 4,
        p_calculation: expect.objectContaining({ closedAt: '2026-10-12T18:00:00.000Z', hoursWorked: 15, totalAmount: 500, totalConsumables: 100, guaranteedAmount: 1500, finalMasterShare: 1500, finalSalonShare: 0 }) }));
    expect(db.from).not.toHaveBeenCalled();
});
test('complete legacy ledger over 1000 items contributes every amount', async () => {
    const rows = Array.from({ length: 1501 }, (_, i) => ({ ...items[0], id: 'item-' + i, booking_id: null, service_amount: i % 11, consumables_amount: 0.5 }));
    const db = setup({ rows: [{ ...snapshot, items: rows }] }); expect(await run(db)).toMatchObject({ ok: true });
    expect(db.rpc).toHaveBeenCalledWith('close_staff_shift_command', expect.objectContaining({ p_calculation: expect.objectContaining({ totalAmount: rows.reduce((sum, row) => sum + row.service_amount, 0), totalConsumables: 750.5 }) }));
});
test('empty ledger review remains an atomic SQL decision and failure is observable', async () => {
    const db = setup({ rows: [{ ...snapshot, items: [] }], closeError: { code: '40001', message: 'SHIFT_NEEDS_REVIEW' } });
    expect(await run(db)).toMatchObject({ ok: false, status: 500, details: { closed: 0, errors: [expect.stringContaining('SHIFT_NEEDS_REVIEW')] } });
    expect(closeCalls(db)).toHaveLength(1); expect(db.from).not.toHaveBeenCalled();
});
test.each([{ claimError: { message: 'offline' } }, { rows: [{ ...snapshot, items: null }] }])('incomplete reads never estimate money: %j', async options => {
    const db = setup(options); expect(await run(db)).toMatchObject({ ok: false, status: 500 }); expect(closeCalls(db)).toHaveLength(0);
});
test('atomic revision conflict is not retried with a fresh revision', async () => {
    const db = setup({ closeError: { code: '40001', message: 'SHIFT_STALE' } }); expect(await run(db)).toMatchObject({ ok: false, details: { errors: [expect.stringContaining('SHIFT_STALE')] } });
    expect(closeCalls(db)).toHaveLength(1);
});
test('backlog hasMore is preserved; invalid timezone does not hide errors or block valid rows', async () => {
    const db = setup({ hasMore: true, configurationErrors: ['other-biz: invalid_business_timezone'] });
    expect(await run(db)).toMatchObject({ ok: false, details: { closed: 1, hasMore: true, errors: ['other-biz: invalid_business_timezone'] } });
});
test('budget releases unstarted claims and reports pending work', async () => {
    const db = setup({ rows: [snapshot, { ...snapshot, shift: { ...shift, id: 'shift-2' } }] });
    const clock = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(CLOSE_SHIFTS_BUDGET_MS);
    expect(await run(db, clock)).toMatchObject({ ok: true, data: { closed: 1, attempted: 1, pending: 1, hasMore: true } });
    expect(db.rpc).toHaveBeenCalledWith('release_staff_shift_claims', expect.objectContaining({ p_shift_ids: ['shift-2'] }));
});
test.each([[23, '2026-03-08T05:00Z', '2026-03-09T04:00Z'], [25, '2026-11-01T04:00Z', '2026-11-02T05:00Z']])('DST financial day supports %s actual hours', async (hours, start, end) => {
    const db = setup({ rows: [{ ...snapshot, dayHours: hours, dayStart: start, closeBoundary: end, timezone: 'America/New_York', shift: { ...shift, opened_at: start } }] });
    expect(await runCloseShiftsCron({ supabase: db as never, now: new Date('2026-11-10T00:00Z') })).toMatchObject({ ok: true });
    expect(db.rpc).toHaveBeenCalledWith('close_staff_shift_command', expect.objectContaining({ p_calculation: expect.objectContaining({ hoursWorked: hours, guaranteedAmount: Number(hours) * 100 }) }));
});
test('ordinary 24-hour day cannot accept a 25-hour interval', async () => {
    const db = setup({ rows: [{ ...snapshot, shift: { ...shift, opened_at: '2026-10-11T17:00Z' } }] });
    expect(await run(db)).toMatchObject({ ok: false, details: { errors: [expect.stringContaining('needs_review')] } }); expect(closeCalls(db)).toHaveLength(0);
});


test('each RPC is aborted at its deadline; unknown commits are not counted or immediately replayed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T00:00Z'));
    try {
        const signals: AbortSignal[] = [];
        const db = { rpc: jest.fn((name: string) => name === 'claim_overdue_staff_shifts'
            ? Promise.resolve({ data: { rows: Array.from({ length: 6 }, (_, i) => ({ ...snapshot, shift: { ...shift, id: 'shift-' + i } })), hasMore: false }, error: null })
            : { abortSignal: (signal: AbortSignal) => { signals.push(signal); return new Promise(() => {}); } }) };
        const pending = runCloseShiftsCron({ supabase: db as never });
        await jest.advanceTimersByTimeAsync(CLOSE_SHIFTS_BUDGET_MS);
        const result = await pending;
        expect(result).toMatchObject({ ok: false, details: { closed: 0, attempted: 5, pending: 1, hasMore: true, errors: expect.arrayContaining([expect.stringContaining('outcome_unconfirmed')]) } });
        expect(signals).toHaveLength(5); expect(signals.every(signal => signal.aborted)).toBe(true);
        expect(db.rpc.mock.calls.filter(([name]) => name === 'close_staff_shift_command')).toHaveLength(5);
        // No deadline left: untouched claims expire by lease; they are not blindly released with an unbounded call.
        expect(db.rpc.mock.calls.some(([name]) => name === 'release_staff_shift_claims')).toBe(false);
    } finally { jest.useRealTimers(); }
});
test('claim timeout returns non-success and never starts financial commands', async () => {
    jest.useFakeTimers();
    try {
        let signal!: AbortSignal; const db = { rpc: jest.fn(() => ({ abortSignal: (value: AbortSignal) => { signal = value; return new Promise(() => {}); } })) };
        const pending = runCloseShiftsCron({ supabase: db as never }); await jest.advanceTimersByTimeAsync(10_000);
        expect(await pending).toMatchObject({ ok: false, status: 500 }); expect(signal.aborted).toBe(true); expect(db.rpc).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
});
