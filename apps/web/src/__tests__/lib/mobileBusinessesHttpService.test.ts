jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAnonClient: jest.fn(),
}));

jest.mock('@/lib/mobileBusinessesService', () => ({
    listMobileBusinesses: jest.fn(),
}));

import { runMobileBusinessesHttp } from '@/lib/mobileBusinessesHttpService';
import { listMobileBusinesses } from '@/lib/mobileBusinessesService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

describe('mobileBusinessesHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseAnonClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates valid request to mobile businesses service', async () => {
        (listMobileBusinesses as jest.Mock).mockResolvedValue({
            ok: true,
            data: [{ id: 'biz-1', name: 'Kezek' }],
        });

        const response = await runMobileBusinessesHttp(
            new Request('http://localhost/api/mobile/businesses?search=kez&category=spa'),
        );
        const body = await response.json();

        expect(listMobileBusinesses).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            search: 'kez',
            category: 'spa',
            page: 1,
            limit: 20,
        });
        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    test('maps internal errors to api response', async () => {
        (listMobileBusinesses as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'internal',
            message: 'failed',
            status: 500,
            details: 'db',
        });

        const response = await runMobileBusinessesHttp(
            new Request('http://localhost/api/mobile/businesses'),
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('internal');
        expect(body.details).toBe('db');
    });
});
