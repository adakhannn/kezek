jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));

import { GET as branchDetail } from '@/app/admin/api/businesses/[id]/branches/[branchId]/detail/route';
import { GET as branchList } from '@/app/admin/api/businesses/[id]/branches/list/route';
import { GET as businessDetail } from '@/app/admin/api/businesses/[id]/detail/route';
import { GET as businessList } from '@/app/admin/api/businesses/list/route';
import { GET as businessApplications } from '@/app/admin/api/business-applications/route';
import { GET as overview } from '@/app/admin/api/overview/route';
import { GET as userDetail } from '@/app/admin/api/users/[id]/detail/route';
import { GET as userStats } from '@/app/admin/api/users/stats/route';
import { readAdminHomeSummary, todayStatusCounts } from '@/lib/adminPanelReadService';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

const BIZ = '11111111-1111-4111-8111-111111111111';
const BRANCH = '22222222-2222-4222-8222-222222222222';
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

type Result = { data?: unknown; error?: unknown; count?: number | null };

/** A PostgREST-like builder: every chain method returns itself, awaiting it gives `result`. */
function builder(result: Result) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lt', 'neq']) chain[method] = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => Promise.resolve(result));
    chain.returns = jest.fn(() => chain);
    chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return chain;
}

function adminWith(tables: Record<string, Result | Result[]>) {
    const calls: Record<string, number> = {};
    return {
        from: jest.fn((table: string) => {
            const entry = tables[table] ?? { data: [], error: null };
            const index = calls[table] ?? 0;
            calls[table] = index + 1;
            return builder(Array.isArray(entry) ? entry[Math.min(index, entry.length - 1)] : entry);
        }),
        rpc: jest.fn(),
        auth: { admin: { getUserById: jest.fn() } },
    };
}

const getUser = jest.fn();
const rpc = jest.fn();

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser }, rpc, from: jest.fn(() => builder({ data: [], error: null })) } as never);
});

function asSuperAdmin() {
    getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
}

const handlers = [
    ['overview', () => overview()],
    ['business list', () => businessList()],
    ['business detail', () => businessDetail(new Request('http://localhost'), ctx({ id: BIZ }))],
    ['branch list', () => branchList(new Request('http://localhost'), ctx({ id: BIZ }))],
    ['branch detail', () => branchDetail(new Request('http://localhost'), ctx({ id: BIZ, branchId: BRANCH }))],
    ['business applications', () => businessApplications()],
    ['user detail', () => userDetail(new Request('http://localhost'), ctx({ id: BIZ }))],
    ['user stats', () => userStats()],
] as const;

describe.each(handlers)('%s access boundary', (_name, handler) => {
    test.each([401, 403, 503])('answers %i before the service client is created', async (status) => {
        getUser.mockResolvedValue({ data: { user: status === 401 ? null : { id: 'ordinary-user' } }, error: null });
        rpc.mockResolvedValue({ data: false, error: status === 503 ? { message: 'unavailable' } : null });
        const response = await handler();
        expect(response.status).toBe(status);
        expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    });
});

describe('page reads as JSON', () => {
    test('branches: the business and its branches; a missing business is 404, a failed read 503', async () => {
        asSuperAdmin();
        jest.mocked(createSupabaseAdminClient).mockReturnValue(adminWith({
            businesses: { data: { id: BIZ, name: 'Low Fade', branch_limit: 2 }, error: null },
            branches: { data: [{ id: BRANCH, name: 'Центр', address: null, is_active: true, created_at: null }], error: null },
        }) as never);
        const ok = await branchList(new Request('http://localhost'), ctx({ id: BIZ }));
        expect(ok.status).toBe(200);
        expect(await ok.json()).toEqual({
            ok: true,
            business: { id: BIZ, name: 'Low Fade', branch_limit: 2 },
            branches: [{ id: BRANCH, name: 'Центр', address: null, is_active: true, created_at: null }],
        });

        jest.mocked(createSupabaseAdminClient).mockReturnValue(adminWith({ businesses: { data: null, error: null } }) as never);
        expect((await branchList(new Request('http://localhost'), ctx({ id: BIZ }))).status).toBe(404);

        jest.mocked(createSupabaseAdminClient).mockReturnValue(adminWith({ branches: { data: null, error: { message: 'boom' } } }) as never);
        const failed = await branchList(new Request('http://localhost'), ctx({ id: BIZ }));
        expect(failed.status).toBe(503);
        // The database text stays in the log; the client gets the read's machine code (R25-29).
        const body = await failed.json();
        expect(body.details).toEqual({ reason: 'load' });
        expect(JSON.stringify(body)).not.toContain('boom');
    });

    test('a branch whose working hours cannot be read is an error, never "closed every day"', async () => {
        asSuperAdmin();
        jest.mocked(createSupabaseAdminClient).mockReturnValue(adminWith({
            branches: { data: { id: BRANCH, biz_id: BIZ, name: 'Центр', is_active: 1, lat: null, lon: null, directory_links: null }, error: null },
            businesses: { data: { id: BIZ, name: 'Low Fade' }, error: null },
            branch_working_hours: { data: null, error: { message: 'down' } },
        }) as never);
        expect((await branchDetail(new Request('http://localhost'), ctx({ id: BIZ, branchId: BRANCH }))).status).toBe(503);
    });

    test('a path id that is not a UUID is refused', async () => {
        asSuperAdmin();
        expect((await userDetail(new Request('http://localhost'), ctx({ id: 'nope' }))).status).toBe(400);
        expect((await businessDetail(new Request('http://localhost'), ctx({ id: 'nope' }))).status).toBe(400);
        expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    });

    test('user stats come from admin_user_stats for the verified actor', async () => {
        asSuperAdmin();
        const admin = adminWith({});
        admin.rpc.mockResolvedValue({ data: { total: 5, active: 4, blocked: 1, super: 2 }, error: null });
        jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
        const response = await userStats();
        expect(await response.json()).toEqual({ ok: true, stats: { total: 5, active: 4, blocked: 1, super: 2 } });
        expect(admin.rpc).toHaveBeenCalledWith('admin_user_stats', { p_actor_id: 'admin-1' });
    });
});

describe('readAdminHomeSummary', () => {
    test('counts, newest businesses and today\'s bookings; a failed count is reported and stays 0', async () => {
        const admin = adminWith({
            businesses: [{ count: 3, error: null }, { data: [{ id: BIZ, name: 'Low Fade', slug: 'low-fade', created_at: '2026-11-25' }], error: null }],
            branches: { count: null, error: { message: 'timeout' } },
            bookings: [{ count: 9, error: null }, {
                data: [{
                    id: 'bk', start_at: 's', end_at: 'e', status: 'hold', client_name: null, client_phone: '+996',
                    services: [{ name_ru: 'Стрижка' }], staff: null, businesses: { id: BIZ, name: 'Low Fade', slug: 'low-fade' }, branches: null,
                }],
                error: null,
            }],
        });
        const summary = await readAdminHomeSummary(admin as never, new Date('2026-11-26T20:00:00Z'));
        expect(summary.day.label).toBe('2026-11-27');
        expect(summary.counts).toEqual(expect.objectContaining({ businesses: 3, branches: 0, bookings: 9 }));
        expect(summary.failures).toEqual([{ source: 'count', count: 'branches', message: 'timeout' }]);
        expect(summary.latestBusinesses).toHaveLength(1);
        expect(summary.todayBookings).toEqual([{
            id: 'bk', start_at: 's', end_at: 'e', status: 'hold', client: '+996', service: 'Стрижка', staff: '—',
            biz: 'Low Fade', bizId: BIZ, branch: '—',
        }]);
        expect(todayStatusCounts([{ status: 'hold' }, { status: 'canceled' }, { status: 'cancelled' }])).toEqual({ hold: 1, confirmed: 0, cancelled: 2 });
    });
});
