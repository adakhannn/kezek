jest.mock('@/lib/telegramLoginRouteService', () => ({
    runTelegramLoginRoute: jest.fn(),
}));

import { runTelegramLoginRoute } from '@/lib/telegramLoginRouteService';

describe('telegramLoginHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('maps route service validation error to http response', async () => {
        (runTelegramLoginRoute as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Недостаточно данных',
            details: { code: 'missing_data' },
        });
        const { runTelegramLoginHttp } = await import('@/lib/telegramLoginHttpService');

        const response = await runTelegramLoginHttp(
            new Request('http://localhost/api/auth/telegram/login', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });

    test('maps route service success to http response', async () => {
        (runTelegramLoginRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                userId: 'user-1',
                email: 'telegram_1@telegram.local',
                password: 'secret',
                needsSignIn: true,
                redirect: '/',
            },
        });
        const { runTelegramLoginHttp } = await import('@/lib/telegramLoginHttpService');

        const response = await runTelegramLoginHttp(
            new Request('http://localhost/api/auth/telegram/login', {
                method: 'POST',
                body: JSON.stringify({ id: 1, hash: 'hash', auth_date: 123 }),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const body = await response.json();

        expect(runTelegramLoginRoute).toHaveBeenCalledWith({
            id: 1,
            hash: 'hash',
            auth_date: 123,
        });
        expect(response.status).toBe(200);
        expect(body.data.userId).toBe('user-1');
    });
});
