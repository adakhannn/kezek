/**
 * @jest-environment node
 */
import { GET } from '@/app/api/dashboard/overview/route';
import { loadDashboardHomeData } from '@/lib/dashboardHomeData';

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/staffApplicationSummary', () => ({ loadStaffApplicationSummary: jest.fn(async () => ({ pending: 2 })) }));

const { getBizContextForManagers } = jest.requireMock('@/lib/authBiz');

/** A PostgREST-like builder: filters return itself; awaiting or maybeSingle gives the result. */
function query(result: { data?: unknown; count?: number | null; error?: unknown }, calls: unknown[][] = []) {
    const settled = { data: result.data ?? null, count: result.count ?? null, error: result.error ?? null };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) {
        builder[method] = jest.fn((...args: unknown[]) => { calls.push([method, ...args]); return builder; });
    }
    builder.maybeSingle = jest.fn(async () => settled);
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(settled).then(resolve);
    return builder;
}

function supabaseWith(counts: Record<string, number | null>, bookingCalls: unknown[][] = []) {
    return {
        from: jest.fn((table: string) => {
            if (table === 'rating_global_config') {
                return query({ data: { staff_reviews_weight: 40, staff_productivity_weight: 30, staff_loyalty_weight: 20, staff_discipline_weight: 10, window_days: 30 } });
            }
            if (table === 'rating_biz_config') return query({ data: null });
            if (table === 'bookings') return query({ count: counts.bookings }, bookingCalls);
            return counts[table] === null ? query({ error: { message: 'timeout' } }) : query({ count: counts[table] });
        }),
    };
}

describe('GET /api/dashboard/overview (the /dashboard numbers for the mobile app)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('the numbers of the current business, today in the business time zone', async () => {
        const bookingCalls: unknown[][] = [];
        getBizContextForManagers.mockResolvedValue({
            supabase: supabaseWith({ staff: 3, services: 5, branches: 1, bookings: 0 }, bookingCalls),
            bizId: 'biz-1',
            userId: 'u-1',
            business: { name: 'Low Fade', tz: 'Asia/Bishkek', rating_score: 61.5 },
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.data).toMatchObject({
            staffApplications: { pending: 2 }, bizName: 'Low Fade', timezone: 'Asia/Bishkek', bookingsToday: 0, staffActive: 3,
            servicesActive: 5, branchesCount: 1, needOnboarding: true, ratingScore: 61.5, ratingConfigScope: 'global',
            ratingWeights: { reviews: 40, productivity: 30, loyalty: 20, discipline: 10, windowDays: 30 },
        });
        expect(bookingCalls).toContainEqual(['eq', 'biz_id', 'biz-1']);
        const gte = bookingCalls.find((call) => call[0] === 'gte');
        expect(String(gte?.[2])).toMatch(/T18:00:00\.000Z$/);
    });

    test('a failed count is an error, not zeros (FE-08)', async () => {
        getBizContextForManagers.mockResolvedValue({
            supabase: supabaseWith({ staff: null, services: 5, branches: 1, bookings: 2 }),
            bizId: 'biz-1',
            userId: 'u-1',
            business: { name: 'Low Fade', tz: 'Asia/Bishkek' },
        });

        const response = await GET();

        expect(response.status).toBe(500);
        expect((await response.json()).ok).toBe(false);
    });

    test('the loader picks the business formula over the global one', async () => {
        const supabase = supabaseWith({ staff: 1, services: 1, branches: 1, bookings: 1 });
        supabase.from.mockImplementation((table: string) => table === 'rating_biz_config'
            ? query({ data: { staff_reviews_weight: 25, staff_productivity_weight: 25, staff_loyalty_weight: 25, staff_discipline_weight: 25, window_days: 14 } })
            : query(table === 'rating_global_config' ? { data: null } : { count: 1 }));
        const data = await loadDashboardHomeData({ supabase: supabase as never, bizId: 'biz-1', userId: 'u-1', business: { tz: null } as never });
        expect(data).toMatchObject({ ratingConfigScope: 'biz', needOnboarding: false, ratingWeights: { windowDays: 14 }, timezone: 'Asia/Bishkek' });
    });
});
