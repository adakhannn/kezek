import { POST } from '@/app/api/auth/telegram/login/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/telegramLoginHttpService', () => ({
    runTelegramLoginHttp: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

const { runTelegramLoginHttp } = require('@/lib/telegramLoginHttpService');

describe('/api/auth/telegram/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates validation error from telegram login http service', async () => {
        runTelegramLoginHttp.mockResolvedValue(
            Response.json(
                { ok: false, error: 'validation', message: 'Недостаточно данных' },
                { status: 400 },
            ),
        );

        const req = createMockRequest('http://localhost/api/auth/telegram/login', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req);
        const data = await expectErrorResponse(res, 400, 'validation');

        expect(data.message).toBe('Недостаточно данных');
    });

    test('delegates success response from telegram login http service', async () => {
        runTelegramLoginHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: {
                    userId: 'user-1',
                    email: 'telegram_1@telegram.local',
                    password: 'secret',
                    needsSignIn: true,
                    redirect: '/',
                },
            }),
        );

        const req = createMockRequest('http://localhost/api/auth/telegram/login', {
            method: 'POST',
            body: {
                id: 1,
                hash: 'hash',
                auth_date: 123,
            },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.userId).toBe('user-1');
        expect(runTelegramLoginHttp).toHaveBeenCalledTimes(1);
    });
});
