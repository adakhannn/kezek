import { boundingBox, loadApprovedBranches, MAX_BRANCH_ROWS } from '@/lib/branches/approvedBranches';
import { haversineDistanceKm } from '@/lib/geo';

import { branch, fakeBranchClient } from './fakeBranchQuery';

describe('boundingBox', () => {
    it('contains every point of the circle, including the far corners', () => {
        const box = boundingBox(42.87, 74.6, 20);
        expect(box.minLon).toBeDefined();
        // Walk the circle and make sure no point falls outside the box.
        for (let bearing = 0; bearing < 360; bearing += 5) {
            const rad = (bearing * Math.PI) / 180;
            const lat = 42.87 + (19.99 / 111.32) * Math.cos(rad);
            const lon = 74.6 + (19.99 / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
            if (haversineDistanceKm(42.87, 74.6, lat, lon) > 20) continue;
            expect(lat).toBeGreaterThanOrEqual(box.minLat);
            expect(lat).toBeLessThanOrEqual(box.maxLat);
            expect(lon).toBeGreaterThanOrEqual(box.minLon!);
            expect(lon).toBeLessThanOrEqual(box.maxLon!);
        }
    });

    it('drops the longitude window across the antimeridian and near the poles', () => {
        expect(boundingBox(10, 179.95, 50)).toEqual({ minLat: expect.any(Number), maxLat: expect.any(Number) });
        expect(boundingBox(89.9, 10, 50)).toEqual({ minLat: expect.any(Number), maxLat: 90 });
    });
});

describe('loadApprovedBranches', () => {
    it('reads branches with their approved business in one filtered, ordered query', async () => {
        const fake = fakeBranchClient([{ data: [branch('a', 42.9, 74.6)], error: null }]);

        const result = await loadApprovedBranches(fake.client, {
            categoryId: ' barbershop ', cityId: 'city-1', bounds: { minLat: 42, maxLat: 43, minLon: 74, maxLon: 75 },
        });

        expect(result).toEqual({ ok: true, rows: [branch('a', 42.9, 74.6)], truncated: false });
        expect(fake.selects[0]).toContain('businesses!branches_biz_id_fkey!inner(');
        expect(fake.calls).toEqual(expect.arrayContaining([
            ['eq', 'is_active', true],
            ['eq', 'businesses.is_approved', true],
            ['eq', 'businesses.city_id', 'city-1'],
            ['contains', 'businesses.categories', ['barbershop']],
            ['gte', 'lat', 42], ['lte', 'lat', 43], ['gte', 'lon', 74], ['lte', 'lon', 75],
            ['order', 'id'],
        ]));
    });

    it('keeps paging past a server row cap until an empty page', async () => {
        // A server max_rows of 2 must not end the read early.
        const fake = fakeBranchClient([
            { data: [branch('a', 1, 1), branch('b', 1, 1)], error: null },
            { data: [branch('c', 1, 1)], error: null },
            { data: [], error: null },
        ]);

        const result = await loadApprovedBranches(fake.client, {});

        expect(result.ok && result.rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
        expect(fake.ranges.map(([from]) => from)).toEqual([0, 2, 3]);
    });

    it('reports truncation at the safety cap instead of silently stopping', async () => {
        const page = Array.from({ length: 1000 }, (_, i) => branch(String(i), 1, 1));
        const fake = fakeBranchClient(Array.from({ length: MAX_BRANCH_ROWS / 1000 + 1 }, () => ({ data: page, error: null })));

        const result = await loadApprovedBranches(fake.client, {});

        expect(result).toMatchObject({ ok: true, truncated: true });
        expect(result.ok && result.rows).toHaveLength(MAX_BRANCH_ROWS);
    });

    it('returns query errors', async () => {
        const fake = fakeBranchClient([{ data: null, error: { message: 'boom' } }]);
        expect(await loadApprovedBranches(fake.client, {})).toEqual({ ok: false, message: 'boom' });
    });
});
