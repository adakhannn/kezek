import { POST } from '@/app/api/business-applications/route';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
    createSupabaseServerClient: jest.fn(),
}));

describe('POST /api/business-applications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requires authentication before accepting an application', async () => {
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
            },
        });

        const response = await POST(new Request('http://localhost/api/business-applications', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
        }));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload).toMatchObject({ ok: false, code: 'auth_required' });
    });
});
