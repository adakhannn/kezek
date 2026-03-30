jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAnonClient: jest.fn(),
}));

jest.mock('@/lib/branchesMapService', () => ({
    listBranchesMap: jest.fn(),
}));

import { runBranchesMapHttp } from '@/lib/branchesMapHttpService';
import { listBranchesMap } from '@/lib/branchesMapService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

describe('branchesMapHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseAnonClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates valid request to branches map service', async () => {
        (listBranchesMap as jest.Mock).mockResolvedValue({
            ok: true,
            data: [{ id: 'branch-1' }],
        });

        const response = await runBranchesMapHttp(
            new Request('http://localhost/api/branches/map?cityId=city-1&categoryId=spa&onlyActive=false'),
        );
        const body = await response.json();

        expect(listBranchesMap).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            cityId: 'city-1',
            categoryId: 'spa',
            onlyActive: false,
        });
        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    test('maps internal errors to api response', async () => {
        (listBranchesMap as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'internal',
            message: 'failed',
            status: 500,
            details: 'db',
        });

        const response = await runBranchesMapHttp(
            new Request('http://localhost/api/branches/map'),
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('internal');
    });
});
