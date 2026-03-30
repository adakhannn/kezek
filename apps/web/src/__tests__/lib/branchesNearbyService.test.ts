import { buildNearbyBranches } from '@/lib/branchesNearbyService';

jest.mock('@/lib/branches/buildApprovedBusinessesQuery', () => ({
    buildApprovedBusinessesQuery: jest.fn(),
}));

import { buildApprovedBusinessesQuery } from '@/lib/branches/buildApprovedBusinessesQuery';
import { createMockSupabase } from '../api/testHelpers';

describe('branchesNearbyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns nearby branches sorted by distance', async () => {
        const supabase = createMockSupabase();
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [{ id: 'biz-1', name: 'Biz One', slug: 'biz-one', categories: ['cat-1'] }],
                error: null,
            }),
        });

        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [
                    { id: 'branch-1', name: 'Near', address: 'A', biz_id: 'biz-1', lat: 42.87, lon: 74.60 },
                    { id: 'branch-2', name: 'Far', address: 'B', biz_id: 'biz-1', lat: 42.95, lon: 74.70 },
                ],
                error: null,
            }),
        });

        const result = await buildNearbyBranches({
            supabase: supabase as never,
            requestUrl: 'http://localhost/api/branches/nearby?lat=42.87&lon=74.60&limit=10&radiusKm=20',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data[0].id).toBe('branch-1');
            expect(result.data[0].businessName).toBe('Biz One');
        }
    });

    test('returns validation error for invalid coords', async () => {
        const supabase = createMockSupabase();

        const result = await buildNearbyBranches({
            supabase: supabase as never,
            requestUrl: 'http://localhost/api/branches/nearby?lat=999&lon=74.60',
        });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Координаты lat и lon обязательны и должны быть в диапазоне: lat -90..90, lon -180..180',
            status: 400,
        });
    });
});
