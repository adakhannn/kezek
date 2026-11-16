import { buildNearbyBranches } from '@/lib/branchesNearbyService';

import { branch, fakeBranchClient } from './branches/fakeBranchQuery';

const url = (query: string) => `http://localhost/api/branches/nearby?${query}`;

describe('branchesNearbyService', () => {
    test('returns nearby branches sorted by distance with category names', async () => {
        const fake = fakeBranchClient([{ data: [
            branch('far', 42.95, 74.70),
            branch('near', 42.87, 74.60, { categories: ['massage'] }),
        ], error: null }], { massage: 'Массаж' });

        const result = await buildNearbyBranches({ supabase: fake.client, requestUrl: url('lat=42.87&lon=74.60&limit=10&radiusKm=20') });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.map(item => item.id)).toEqual(['near', 'far']);
            expect(result.data[0]).toMatchObject({ businessName: 'Business near', categoryId: 'massage', categoryName: 'Массаж', distanceKm: 0 });
        }
    });

    test('filters candidates by a bounding box in SQL before any limit', async () => {
        const fake = fakeBranchClient([{ data: [], error: null }]);

        await buildNearbyBranches({ supabase: fake.client, requestUrl: url('lat=40.51&lon=72.80&radiusKm=20&categoryId=spa&cityId=osh') });

        const bound = (op: string, column: string) => fake.calls.find(([name, col]) => name === op && col === column)?.[2] as number;
        expect(bound('gte', 'lat')).toBeCloseTo(40.51 - 20 / 111.32, 6);
        expect(bound('lte', 'lat')).toBeCloseTo(40.51 + 20 / 111.32, 6);
        expect(bound('gte', 'lon')).toBeLessThan(72.80 - 0.23);
        expect(bound('lte', 'lon')).toBeGreaterThan(72.80 + 0.23);
        expect(fake.calls).toEqual(expect.arrayContaining([
            ['contains', 'businesses.categories', ['spa']], ['eq', 'businesses.city_id', 'osh'],
        ]));
    });

    test('drops box corners outside the radius and honours the limit', async () => {
        const fake = fakeBranchClient([{ data: [
            branch('a', 42.870, 74.600), branch('b', 42.871, 74.600), branch('c', 42.872, 74.600),
            branch('corner', 42.87 + 0.17, 74.60 + 0.24),
        ], error: null }]);

        const result = await buildNearbyBranches({ supabase: fake.client, requestUrl: url('lat=42.87&lon=74.60&radiusKm=20&limit=2') });

        expect(result.ok && result.data.map(item => item.id)).toEqual(['a', 'b']);
    });

    test('hides database error text from the public response', async () => {
        const fake = fakeBranchClient([{ data: null, error: { message: 'relation "branches" secret detail' } }]);

        const result = await buildNearbyBranches({ supabase: fake.client, requestUrl: url('lat=42.87&lon=74.60') });

        expect(result).toEqual({ ok: false, error: 'internal', message: 'Не удалось загрузить филиалы', status: 500 });
    });

    test('returns validation error for invalid coords', async () => {
        const result = await buildNearbyBranches({ supabase: fakeBranchClient([]).client, requestUrl: url('lat=999&lon=74.60') });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Координаты lat и lon обязательны и должны быть в диапазоне: lat -90..90, lon -180..180',
            status: 400,
        });
    });
});
