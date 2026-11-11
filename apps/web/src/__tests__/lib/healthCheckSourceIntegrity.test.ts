import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';
const now = new Date('2026-11-10T12:00:00Z');

function dependencies(options: { failure?: string; open?: number; promos?: number; staleBiz?: boolean; missingCount?: boolean } = {}) {
    const sendAlertEmail = jest.fn().mockResolvedValue({ success: true });
    const admin = { from: jest.fn((table: string) => {
        const response = () => {
            if (options.failure === table) return { data: null, count: null, error: { message: 'Unavailable' } };
            if (table.endsWith('day_metrics')) return { data: { metric_date: table === 'biz_day_metrics' && options.staleBiz ? '2026-11-01' : '2026-11-10' }, error: null };
            if (table === 'client_promotion_usage') return { data: null, error: null };
            return { data: null, error: null, count: options.missingCount ? null : table === 'staff_shifts' ? options.open ?? 0 : table === 'branch_promotions' ? options.promos ?? 0 : 0 };
        };
        const query = { select: jest.fn(), eq: jest.fn(), lt: jest.fn(), gte: jest.fn(), order: jest.fn(), limit: jest.fn(),
            maybeSingle: jest.fn(async () => response()), then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve) };
        for (const method of [query.select, query.eq, query.lt, query.gte, query.order, query.limit]) method.mockReturnValue(query);
        return query;
    }) };
    return { admin: admin as never, sendAlertEmail, now, tz: 'Asia/Bishkek', formatDate: () => '2026-11-08' };
}
test('HEAD counts include 1201 overdue shifts and active promotions even though response data is null', async () => {
    const deps = dependencies({ open: 1201, promos: 4 });
    const result = await runHealthCheckAlerts(deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.healthCheck.checks.shifts).toMatchObject({ openShiftsOlderThan2Days: 1201 });
    expect(result.data.healthCheck.checks.promotions).toMatchObject({ activePromotionsCount: 4, ok: false });
    expect(deps.sendAlertEmail).toHaveBeenCalledTimes(1);
});
test.each(['staff_shifts', 'branch_promotions', 'staff_day_metrics', 'branch_day_metrics', 'biz_day_metrics', 'client_promotion_usage', 'analytics_events'])('%s error cannot be reported as a healthy zero', async failure => {
    const deps = dependencies({ failure });
    expect(await runHealthCheckAlerts(deps)).toMatchObject({ ok: false, status: 500 });
    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
});
test('missing exact count is an unavailable check, not zero', async () => {
    expect(await runHealthCheckAlerts(dependencies({ missingCount: true }))).toMatchObject({ ok: false, status: 500 });
});
test('fresh staff/branch metrics do not conceal stale business metrics', async () => {
    const result = await runHealthCheckAlerts(dependencies({ staleBiz: true }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.healthCheck.checks.ratings).toMatchObject({ ok: false, daysSinceLastMetric: 9 });
});
test('missed cron execution becomes an explicit alert', async () => {
    const deps = dependencies();
    const result = await runHealthCheckAlerts({ ...deps, cronStatuses: [{ job: 'close-shifts', status: 'overdue',
        lastSuccessAt: '2026-11-09T12:00:00Z', lastStartedAt: '2026-11-09T12:00:00Z', runningCount: 0 }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.healthCheck.checks.cronExecutions).toMatchObject({ ok: false });
    expect(deps.sendAlertEmail).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ message: 'Cron close-shifts: overdue' })]));
});

test('a successful cron cannot conceal ambiguous delivery or a delayed queue', async () => {
    const deps = dependencies();
    const counts = { pending: 1, due: 1, processing: 0, failed: 0, ambiguous: 1, oldest_due_age_seconds: 601 };
    const result = await runHealthCheckAlerts({ ...deps, queueStatuses: [
        { job: 'booking-notifications', status: 'failed', counts },
        { job: 'whatsapp-inbox', status: 'backlog', counts: { ...counts, ambiguous: 0 } },
    ] });
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.healthCheck.ok).toBe(false);
        expect(result.data.healthCheck.checks.backgroundQueues).toMatchObject({ ok: false });
    }
    expect(deps.sendAlertEmail).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ message: 'Queue booking-notifications: failed' }),
        expect.objectContaining({ message: 'Queue whatsapp-inbox: backlog' }),
    ]));
});
