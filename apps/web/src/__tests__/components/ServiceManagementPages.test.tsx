import ServicesListPage from '@/app/dashboard/services/page';
import EditServicePage from '@/app/dashboard/services/[id]/page';

const mockContext = jest.fn();
const mockServiceClient = jest.fn();
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: () => mockContext() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: () => mockServiceClient() }));
jest.mock('@/app/_components/i18n/server', () => ({ getServerLocale: async () => 'ru', getT: () => String }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn() }));
jest.mock('@/app/dashboard/services/ServicesListClient', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/services/[id]/EditServicePageClient', () => ({ __esModule: true, default: () => null }));
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));

const row = (id: string, branch_id: string, active: boolean) => ({
    id, biz_id: 'biz-1', branch_id, active, name_ru: 'Same service',
    name_ky: null, name_en: null, duration_min: 30, price_from: 150, price_to: 250,
});

function database(services: ReturnType<typeof row>[], serviceReadError = false) {
    return { from: jest.fn((table: string) => {
        const filters: [string, unknown][] = [];
        const query = {
            select: jest.fn(() => query),
            eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
            order: jest.fn(() => query),
            maybeSingle: jest.fn(async () => ({ data: filtered()[0] ?? null, error: serviceReadError ? { message: 'read failed' } : null })),
            then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: filtered(), error: null }).then(resolve),
        };
        function filtered() {
            const records: Record<string, unknown>[] = table === 'services' ? services : [
                { id: 'branch-1', name: 'Branch 1', biz_id: 'biz-1', is_active: true },
                { id: 'branch-2', name: 'Branch 2', biz_id: 'biz-1', is_active: true },
            ];
            return records.filter(record => filters.every(([key, value]) => record[key] === value));
        }
        return query;
    }) };
}

describe('service management projections', () => {
    function setup(services: ReturnType<typeof row>[]) {
        const db = database(services);
        mockContext.mockResolvedValue({ bizId: 'biz-1', business: { name: 'Business' }, supabase: db });
        mockServiceClient.mockReturnValue(db);
    }

    it('retains a hidden service with an editable ID and saved branch', async () => {
        setup([row('hidden-1', 'branch-2', false)]);
        const result = await ServicesListPage({});
        expect(result.props.list).toEqual([expect.objectContaining({ first_id: 'hidden-1', active: false, branch_ids: ['branch-2'] })]);
    });

    it('keeps active name groups unchanged rather than exposing a second destructive edit target', async () => {
        setup([row('active-1', 'branch-1', true), row('hidden-2', 'branch-2', false)]);
        const result = await ServicesListPage({});
        expect(result.props.list).toHaveLength(1);
        expect(result.props.list[0]).toMatchObject({ active: true, branch_ids: ['branch-1'] });
    });

    it('preserves active grouping and the selected branch filter', async () => {
        setup([row('active-1', 'branch-1', true), row('active-2', 'branch-2', true), row('hidden-2', 'branch-2', false)]);
        const all = await ServicesListPage({});
        expect(all.props.list[0].branch_ids).toEqual(['branch-1', 'branch-2']);
        const filtered = await ServicesListPage({ searchParams: Promise.resolve({ branch: 'branch-1' }) });
        expect(filtered.props.list).toHaveLength(1);
        expect(filtered.props.list[0].branch_ids).toEqual(['branch-1']);
    });

    it.each([true, false])('loads saved branches for an active=%s edit without mixing visibility', async active => {
        setup([row('selected', 'branch-2', active), row('other', 'branch-1', !active)]);
        const result = await EditServicePage({ params: Promise.resolve({ id: 'selected' }) });
        expect(result.props.serviceBranchIds).toEqual(['branch-2']);
        expect(result.props.svc.active).toBe(active);
    });

    it('keeps cross-business rows out of management', async () => {
        setup([{ ...row('foreign', 'branch-2', false), biz_id: 'foreign-biz' }]);
        const result = await ServicesListPage({});
        expect(result.props.list).toEqual([]);
        await expect(EditServicePage({ params: Promise.resolve({ id: 'foreign' }) })).rejects.toThrow('not found');
    });

    it('keeps the same hidden branch selection with the scoped RLS fallback', async () => {
        setup([row('hidden-1', 'branch-2', false)]);
        mockServiceClient.mockImplementationOnce(() => { throw new Error('service client unavailable'); });
        const result = await EditServicePage({ params: Promise.resolve({ id: 'hidden-1' }) });
        expect(result.props.serviceBranchIds).toEqual(['branch-2']);
        expect(result.props.svc.active).toBe(false);
    });

    it('preserves optional translations on the edit form', async () => {
        const db = database([row('hidden-1', 'branch-2', false)]);
        const originalFrom = db.from;
        db.from = jest.fn((table: string) => {
            const query = originalFrom(table);
            if (table === 'services') query.maybeSingle.mockResolvedValue({
                data: { ...row('hidden-1', 'branch-2', false), name_ky: 'Кыргызча', name_en: 'English' }, error: null,
            });
            return query;
        });
        mockContext.mockResolvedValue({ bizId: 'biz-1', supabase: db });
        mockServiceClient.mockReturnValue(db);
        const result = await EditServicePage({ params: Promise.resolve({ id: 'hidden-1' }) });
        expect(result.props.svc).toMatchObject({ name_ky: 'Кыргызча', name_en: 'English' });
    });

    it('does not render an editable service when the scoped service read fails', async () => {
        const db = database([row('hidden-1', 'branch-2', false)], true);
        mockContext.mockResolvedValue({ bizId: 'biz-1', supabase: db });
        mockServiceClient.mockReturnValue(db);
        await expect(EditServicePage({ params: Promise.resolve({ id: 'hidden-1' }) })).rejects.toThrow('not found');
    });
});
