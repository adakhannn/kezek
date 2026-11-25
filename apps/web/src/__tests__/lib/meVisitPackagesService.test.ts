import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';

type Result = { data: unknown; error?: { message: string } | null };

/** A Supabase-like client whose every chain on `table` resolves to `results[table]`. */
function adminFor(results: Record<string, Result>) {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const from = jest.fn((table: string) => {
        const result = results[table] ?? { data: null, error: null };
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'order', 'in', 'gte', 'gt']) {
            chain[method] = (...args: unknown[]) => {
                calls.push({ table, method, args });
                return chain;
            };
        }
        chain.then = (resolve: (value: Result) => unknown) => Promise.resolve({ error: null, ...result }).then(resolve);
        return chain;
    });
    return { admin: { from } as never, calls };
}

const pkg = (id: string, plan_id: string, valid_until: string, remaining_visits = 3) => ({
    id,
    client_id: 'user-1',
    plan_id,
    remaining_visits,
    valid_until,
    purchased_at: '2026-03-01',
    created_at: '2026-03-01',
});

const plan = (id: string, biz_id: string) => ({
    id,
    biz_id,
    name_ru: `План ${id}`,
    name_ky: null,
    name_en: null,
    visit_count: 10,
});

describe('meVisitPackagesService', () => {
    test('returns empty list when user has no packages', async () => {
        const { admin } = adminFor({ client_visit_packages: { data: [] } });

        const result = await listCurrentUserVisitPackages({ admin, user: { id: 'user-1' }, includeAll: true });

        expect(result).toEqual({ ok: true, data: { packages: [] } });
    });

    test('returns mapped package data with plan details', async () => {
        const { admin } = adminFor({
            client_visit_packages: { data: [pkg('pkg-1', 'plan-1', '2026-04-10')] },
            visit_package_plans: {
                data: [{ ...plan('plan-1', 'biz-1'), name_ru: 'Пакет 10', name_en: 'Package 10' }],
            },
            businesses: { data: [{ id: 'biz-1', tz: 'Asia/Bishkek' }] },
        });

        const result = await listCurrentUserVisitPackages({
            admin,
            user: { id: 'user-1' },
            includeAll: true,
            now: new Date('2026-03-27T10:00:00Z'),
        });

        expect(result).toEqual({
            ok: true,
            data: {
                packages: [
                    {
                        id: 'pkg-1',
                        plan_id: 'plan-1',
                        plan_name_ru: 'Пакет 10',
                        plan_name_ky: null,
                        plan_name_en: 'Package 10',
                        remaining_visits: 3,
                        plan_visit_count: 10,
                        valid_until: '2026-04-10',
                        purchased_at: '2026-03-01',
                        created_at: '2026-03-01',
                        is_active: true,
                    },
                ],
            },
        });
    });

    test('decides "active" by today in each business time zone (ARCH-11)', async () => {
        // 2026-11-09 20:00 UTC: already 10 Nov in Bishkek (+6), still 9 Nov in London.
        const { admin } = adminFor({
            client_visit_packages: {
                data: [
                    pkg('bishkek', 'plan-bishkek', '2026-11-09'),
                    pkg('london', 'plan-london', '2026-11-09'),
                    pkg('no-zone', 'plan-no-zone', '2026-11-09'),
                    pkg('used-up', 'plan-london', '2026-12-01', 0),
                ],
            },
            visit_package_plans: {
                data: [plan('plan-bishkek', 'biz-bishkek'), plan('plan-london', 'biz-london'), plan('plan-no-zone', 'biz-no-zone')],
            },
            businesses: {
                data: [
                    { id: 'biz-bishkek', tz: 'Asia/Bishkek' },
                    { id: 'biz-london', tz: 'Europe/London' },
                    { id: 'biz-no-zone', tz: null },
                ],
            },
        });
        const now = new Date('2026-11-09T20:00:00Z');

        const all = await listCurrentUserVisitPackages({ admin, user: { id: 'user-1' }, includeAll: true, now });
        const active = await listCurrentUserVisitPackages({ admin, user: { id: 'user-1' }, includeAll: false, now });

        if (!all.ok || !active.ok) throw new Error('expected ok');
        expect(Object.fromEntries(all.data.packages.map((p) => [p.id, p.is_active]))).toEqual({
            bishkek: false,
            london: true,
            'no-zone': false, // no zone → Asia/Bishkek
            'used-up': false,
        });
        expect(active.data.packages.map((p) => p.id)).toEqual(['london']);
    });

    test('pre-filters active packages a day before the UTC date', async () => {
        const { admin, calls } = adminFor({ client_visit_packages: { data: [] } });

        await listCurrentUserVisitPackages({
            admin,
            user: { id: 'user-1' },
            includeAll: false,
            now: new Date('2026-11-09T20:00:00Z'),
        });

        expect(calls).toContainEqual({ table: 'client_visit_packages', method: 'gte', args: ['valid_until', '2026-11-08'] });
        expect(calls).toContainEqual({ table: 'client_visit_packages', method: 'gt', args: ['remaining_visits', 0] });
    });

    test('returns server error when packages query fails', async () => {
        const { admin } = adminFor({ client_visit_packages: { data: null, error: { message: 'db failed' } } });

        const result = await listCurrentUserVisitPackages({ admin, user: { id: 'user-1' }, includeAll: true });

        expect(result).toEqual({
            ok: false,
            error: 'server',
            message: 'Не удалось загрузить пакеты',
            details: 'db failed',
            status: 500,
        });
    });
});
