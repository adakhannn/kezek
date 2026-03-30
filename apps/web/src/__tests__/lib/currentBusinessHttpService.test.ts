import {
    getCurrentBusinessClients,
    runGetCurrentBusinessHttp,
    runSetCurrentBusinessHttp,
} from '@/lib/currentBusinessHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/currentBusinessService', () => ({
    getCurrentBusinessState: jest.fn(),
    setCurrentBusinessState: jest.fn(),
}));

const { createSupabaseServerClient, createSupabaseAdminClient } = require('@/lib/supabaseHelpers');
const { getCurrentBusinessState, setCurrentBusinessState } = require('@/lib/currentBusinessService');

describe('currentBusinessHttpService', () => {
    const supabase = { auth: { getUser: jest.fn() } };
    const admin = { from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        createSupabaseServerClient.mockResolvedValue(supabase);
        createSupabaseAdminClient.mockReturnValue(admin);
    });

    test('falls back to server client when admin client is unavailable', async () => {
        createSupabaseAdminClient.mockImplementation(() => {
            throw new Error('missing key');
        });

        const clients = await getCurrentBusinessClients();

        expect(clients).toEqual({ supabase, admin: supabase });
    });

    test('maps get current business success to response', async () => {
        getCurrentBusinessState.mockResolvedValue({
            ok: true,
            data: { currentBizId: 'biz-1', businesses: [] },
        });

        const res = await runGetCurrentBusinessHttp();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.currentBizId).toBe('biz-1');
    });

    test('maps set current business validation error to response', async () => {
        setCurrentBusinessState.mockResolvedValue({
            ok: false,
            error: 'validation',
            message: 'bizId обязателен',
            status: 400,
        });

        const res = await runSetCurrentBusinessHttp(
            new Request('http://localhost/api/me/current-business', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
    });
});
