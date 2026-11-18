import { GET } from '@/app/api/profile/notification-emails/route';

jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseClients: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));

import { logWarn } from '@/lib/log';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

describe('GET /api/profile/notification-emails (API-08)', () => {
    const rows = [{ id: 'e-1', email: 'primary@example.com', verified: true, enabled: true }];

    function setup(user: Record<string, unknown>, adminRpc: jest.Mock) {
        const supabaseRpc = jest.fn().mockResolvedValue({ data: rows, error: null });
        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) }, rpc: supabaseRpc },
            admin: { rpc: adminRpc },
        });
        return { supabaseRpc };
    }

    beforeEach(() => jest.clearAllMocks());

    test('a forged user_metadata.yandex_email is never synced as a notification address', async () => {
        const adminRpc = jest.fn().mockResolvedValue({ error: null });
        setup({ id: 'user-1', email: null, identities: [], user_metadata: { yandex_id: '1', yandex_email: 'victim@example.com' } }, adminRpc);

        const response = await GET();

        expect(response.status).toBe(200);
        expect(adminRpc).not.toHaveBeenCalledWith('sync_user_notification_email', expect.objectContaining({ target_source: 'yandex' }));
    });

    test('a refused refresh still returns the existing addresses', async () => {
        const adminRpc = jest.fn().mockResolvedValue({ error: { message: 'NOTIFICATION_EMAIL_NOT_PROVEN' } });
        setup({ id: 'user-1', email: 'primary@example.com', email_confirmed_at: '2026-11-18T00:00:00Z', identities: [] }, adminRpc);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ ok: true, data: rows });
        expect(logWarn).toHaveBeenCalledWith('NotificationEmails', 'Failed to sync notification emails', expect.any(Error));
    });

    test('without a session the route answers 401', async () => {
        setup(null as unknown as Record<string, unknown>, jest.fn());

        const response = await GET();

        expect(response.status).toBe(401);
    });
});
