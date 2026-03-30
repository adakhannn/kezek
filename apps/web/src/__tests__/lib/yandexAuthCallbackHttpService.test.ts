jest.mock('@/lib/yandexAuthCallbackRouteService', () => ({
    runYandexAuthCallbackRoute: jest.fn(),
}));

import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';

describe('yandexAuthCallbackHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('redirects using route service result', async () => {
        (runYandexAuthCallbackRoute as jest.Mock).mockResolvedValue({
            ok: true,
            redirectUrl: 'https://kezek.kg/',
        });
        const { runYandexAuthCallbackHttp } = await import('@/lib/yandexAuthCallbackHttpService');

        const response = await runYandexAuthCallbackHttp(
            new Request('http://localhost/api/auth/yandex/callback?code=123'),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://kezek.kg/');
    });
});
