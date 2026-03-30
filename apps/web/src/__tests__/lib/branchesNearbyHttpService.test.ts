jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
    getSupabaseUrl: jest.fn(() => 'https://example.supabase.co'),
    getSupabaseAnonKey: jest.fn(() => 'anon-key'),
}));

jest.mock('@/lib/branchesNearbyService', () => ({
    buildNearbyBranches: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

import { buildNearbyBranches } from '@/lib/branchesNearbyService';
import { runBranchesNearbyHttp } from '@/lib/branchesNearbyHttpService';

describe('branchesNearbyHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates valid request to nearby service', async () => {
        (buildNearbyBranches as jest.Mock).mockResolvedValue({
            ok: true,
            data: [{ id: 'branch-1', distanceKm: 1.2 }],
        });

        const response = await runBranchesNearbyHttp(
            new Request('http://localhost/api/branches/nearby?lat=43.2&lon=76.8'),
        );
        const body = await response.json();

        expect(buildNearbyBranches).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            requestUrl: 'http://localhost/api/branches/nearby?lat=43.2&lon=76.8',
        });
        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    test('maps validation errors to api response', async () => {
        (buildNearbyBranches as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'validation',
            message: 'bad coords',
            status: 400,
        });

        const response = await runBranchesNearbyHttp(
            new Request('http://localhost/api/branches/nearby?lat=999&lon=999'),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });
});
