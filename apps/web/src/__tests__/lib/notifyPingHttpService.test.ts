import { runNotifyPingHttp } from '@/lib/notifyPingHttpService';
import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
jest.mock('@/lib/adminHttpAccess', () => ({ requireCurrentSuperAdmin: jest.fn() }));

jest.mock('@/lib/notifyPingService', () => ({
    runNotifyPing: jest.fn(),
}));

import { runNotifyPing } from '@/lib/notifyPingService';

describe('notifyPingHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(requireCurrentSuperAdmin).mockResolvedValue({ ok: true, user: { id: 'admin', email: 'user@example.com', email_confirmed_at: '2026-01-01' } } as never);
    });

    test('delegates valid request to notify ping service', async () => {
        (runNotifyPing as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                ok: true,
                status: 202,
                text: '{"id":"email_123"}',
            },
        });

        const response = await runNotifyPingHttp(
            new Request('http://localhost/api/notify/ping', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    to: 'user@example.com',
                }),
            }),
        );
        const body = await response.json();

        expect(runNotifyPing).toHaveBeenCalledWith({
            to: 'user@example.com',
            env: process.env,
        });
        expect(response.status).toBe(200);
        expect(body.data.status).toBe(202);
    });

    test('maps service validation errors', async () => {
        (runNotifyPing as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'missing key',
            details: { code: 'no RESEND_API_KEY' },
        });

        const response = await runNotifyPingHttp(
            new Request('http://localhost/api/notify/ping', {
                method: 'POST',
                body: JSON.stringify({ to: 'user@example.com' }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
        expect(body.details).toEqual({ code: 'no RESEND_API_KEY' });
    });

    test.each([
        [{ to: 'other@example.com' }, 403],
        [{ to: ['user@example.com', 'other@example.com'] }, 400],
        [{ to: 'user@example.com', from: 'attacker@example.com' }, 400],
    ])('rejects arbitrary recipients and sender overrides: %p', async (body, status) => {
        const response = await runNotifyPingHttp(new Request('http://localhost/api/notify/ping', { method: 'POST', body: JSON.stringify(body) }));
        expect(response.status).toBe(status);
        expect(runNotifyPing).not.toHaveBeenCalled();
    });

    test('requires a confirmed email even for a super administrator', async () => {
        jest.mocked(requireCurrentSuperAdmin).mockResolvedValue({ ok: true, user: { id: 'admin', email: 'user@example.com' } } as never);
        const response = await runNotifyPingHttp(new Request('http://localhost/api/notify/ping', { method: 'POST', body: '{}' }));
        expect(response.status).toBe(403);
        expect(runNotifyPing).not.toHaveBeenCalled();
    });
});
