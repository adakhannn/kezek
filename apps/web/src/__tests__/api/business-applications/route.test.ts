import { POST } from '@/app/api/business-applications/route';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

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

    it('returns an explicit safe response when privileged server configuration is missing', async () => {
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'user-1' } },
                    error: null,
                }),
            },
        });
        (createSupabaseAdminClient as jest.Mock).mockImplementation(() => {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations');
        });

        const response = await POST(new Request('http://localhost/api/business-applications', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                contact_name: 'Owner',
                phone: '+996500000000',
                email: 'owner@example.com',
                business_name: 'Test business',
                category: 'barbershop',
            }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(503);
        expect(payload).toEqual({
            ok: false,
            message: 'Business application submission is temporarily unavailable',
            code: 'service_unavailable',
        });
    });
});
