import { runNotifyPing } from '@/lib/notifyPingService';

describe('notifyPingService', () => {
    test('returns validation error when resend api key is missing', async () => {
        const result = await runNotifyPing({
            to: 'user@example.com',
            env: {},
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'RESEND_API_KEY не установлен',
            details: { code: 'no RESEND_API_KEY' },
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
                text: '{"id":"email_123"}',
            },
        });
    });
});
