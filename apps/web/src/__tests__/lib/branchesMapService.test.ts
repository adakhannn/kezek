import { listBranchesMap } from '@/lib/branchesMapService';
import { loadPublicCategoryLabels } from '@/lib/publicCategoryLabels';

import { branch, fakeBranchClient } from './branches/fakeBranchQuery';

jest.mock('@/lib/publicCategoryLabels', () => ({ loadPublicCategoryLabels: jest.fn() }));

describe('branchesMapService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(loadPublicCategoryLabels).mockResolvedValue({ massage: 'Massage', wellness: 'Wellness' });
    });

    test('returns a query error without fetching labels or leaking database text', async () => {
        const fake = fakeBranchClient([{ data: null, error: { message: 'secret detail' } }]);

        const result = await listBranchesMap({ supabase: fake.client });

        expect(result).toEqual({ ok: false, error: 'internal', message: 'Не удалось загрузить филиалы для карты', status: 500 });
        expect(loadPublicCategoryLabels).not.toHaveBeenCalled();
    });

    test('returns no labels when there are no mapped branches', async () => {
        expect(await listBranchesMap({ supabase: fakeBranchClient([]).client })).toEqual({ ok: true, data: [] });
        expect(loadPublicCategoryLabels).not.toHaveBeenCalled();
    });

    test('lists only active branches of approved businesses, with every page', async () => {
        const fake = fakeBranchClient([
            { data: [branch('1', 40, 72, { categories: ['massage'] })], error: null },
            { data: [branch('2', '40.5' as never, '72.5' as never, { name: null, slug: null, categories: null })], error: null },
        ]);

        const result = await listBranchesMap({ supabase: fake.client, cityId: 'osh' });

        expect(fake.calls).toEqual(expect.arrayContaining([
            ['eq', 'is_active', true], ['eq', 'businesses.is_approved', true], ['eq', 'businesses.city_id', 'osh'],
        ]));
        expect(result).toMatchObject({ ok: true, data: [
            { id: '1', businessId: 'biz-1', categoryId: 'massage', categoryName: 'Massage', lat: 40, lon: 72 },
            { id: '2', businessName: '', businessSlug: null, categoryId: null, categoryName: null, lat: 40.5, lon: 72.5 },
        ] });
    });

    test('a requested category is the resolved category of every branch', async () => {
        const fake = fakeBranchClient([{ data: [branch('1', 42.8, 74.6, { categories: ['massage'] })], error: null }]);

        const result = await listBranchesMap({ supabase: fake.client, categoryId: 'wellness' });

        expect(loadPublicCategoryLabels).toHaveBeenCalledWith(fake.client, ['wellness']);
        expect(fake.calls).toContainEqual(['contains', 'businesses.categories', ['wellness']]);
        expect(result).toEqual({ ok: true, data: [{
            id: '1', businessId: 'biz-1', businessName: 'Business 1', businessSlug: 'business-1', branchName: 'Branch 1',
            address: null, lat: 42.8, lon: 74.6, categoryId: 'wellness', categoryName: 'Wellness',
        }] });
    });
});
