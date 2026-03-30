import { runNotifyPingHttp } from '@/lib/notifyPingHttpService';

jest.mock('@/lib/notifyPingService', () => ({
    runNotifyPing: jest.fn(),
}));

import { runNotifyPing } from '@/lib/notifyPingService';

describe('notifyPingHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
                    from: 'noreply@example.com',
                }),
            }),
        );
        const body = await response.json();

        expect(runNotifyPing).toHaveBeenCalledWith({
            to: 'user@example.com',
            from: 'noreply@example.com',
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
});
