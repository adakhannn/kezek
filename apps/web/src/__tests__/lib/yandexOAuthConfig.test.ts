import { getYandexCallbackUrl, getYandexPublicOrigin } from '@/lib/yandexOAuthConfig';

const proxiedRequest = 'https://localhost:3000/api/auth/yandex/start';

describe('Yandex OAuth public origin', () => {
    test('uses an explicit HTTPS tunnel origin during local development', () => {
        const env = {
            NODE_ENV: 'development',
            YANDEX_OAUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com',
        };

        expect(getYandexPublicOrigin(proxiedRequest, env)).toBe('https://test.trycloudflare.com');
        expect(getYandexCallbackUrl(proxiedRequest, env)).toBe(
            'https://test.trycloudflare.com/auth/callback-yandex',
        );
    });

    test('does not let the local override change production redirects', () => {
        expect(getYandexCallbackUrl(proxiedRequest, {
            NODE_ENV: 'production',
            YANDEX_OAUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com',
        })).toBe('https://localhost:3000/auth/callback-yandex');
    });

    test('rejects an unsafe or malformed local override', () => {
        for (const configuredOrigin of [
            'http://test.trycloudflare.com',
            'https://test.trycloudflare.com/other-path',
            'https://user:password@test.trycloudflare.com',
            'not-a-url',
        ]) {
            expect(getYandexPublicOrigin(proxiedRequest, {
                NODE_ENV: 'development',
                YANDEX_OAUTH_PUBLIC_ORIGIN: configuredOrigin,
            })).toBe('https://localhost:3000');
        }
    });
});
