import { runNotifyPing } from '@/lib/notifyPingService';

describe('notifyPingService', () => {
    test('does not send when provider settings are missing', async () => {
        const result = await runNotifyPing({
            to: 'user@example.com',
            env: {},
        });

        expect(result).toEqual({
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Отправка диагностических писем не настроена',
        });
    });

    test('sends ping email through provided fetch implementation', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 202,
            text: jest.fn().mockResolvedValue('{"id":"email_123"}'),
        });

        const result = await runNotifyPing({
            to: 'user@example.com',
            env: {
                RESEND_API_KEY: 'test-resend-key',
                EMAIL_FROM: 'noreply@example.com',
            },
            fetchImpl: fetchImpl as never,
        });

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.resend.com/emails',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-resend-key',
                }),
            }),
        );
        expect(result).toEqual({
            ok: true,
            payload: {
                ok: true,
                status: 202,
            },
        });
    });

    test('provider rejection is an HTTP failure, not a successful ping', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
        const result = await runNotifyPing({ to: 'admin@example.invalid', env: { RESEND_API_KEY: 'fake', EMAIL_FROM: 'sender@example.invalid' }, fetchImpl });
        expect(result).toMatchObject({ ok: false, status: 502, error: 'service_unavailable', details: { providerStatus: 429 } });
    });

    test('network/timeout failure is reported without leaking provider details', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('secret provider payload'));
        const result = await runNotifyPing({ to: 'admin@example.invalid', env: { RESEND_API_KEY: 'fake', EMAIL_FROM: 'sender@example.invalid' }, fetchImpl });
        expect(result).toMatchObject({ ok: false, status: 502 });
        expect(JSON.stringify(result)).not.toContain('secret provider payload');
    });
});
