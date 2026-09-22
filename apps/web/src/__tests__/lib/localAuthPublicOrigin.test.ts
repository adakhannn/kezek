import { getLocalAuthPublicOrigin } from '@/lib/localAuthPublicOrigin';

const proxiedCallback = 'https://localhost:3000/auth/callback/google?code=test';

describe('local auth public origin', () => {
    test('uses the configured tunnel for a proxied Google callback', () => {
        expect(getLocalAuthPublicOrigin(proxiedCallback, {
            NODE_ENV: 'development',
            LOCAL_AUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com',
        })).toBe('https://test.trycloudflare.com');
    });

    test('ignores the local override in production', () => {
        expect(getLocalAuthPublicOrigin(proxiedCallback, {
            NODE_ENV: 'production',
            LOCAL_AUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com',
        })).toBe('https://localhost:3000');
    });

    test('does not use malformed or non-HTTPS overrides', () => {
        for (const origin of ['http://test.trycloudflare.com', 'https://test.trycloudflare.com/other', 'not-a-url']) {
            expect(getLocalAuthPublicOrigin(proxiedCallback, {
                NODE_ENV: 'development',
                LOCAL_AUTH_PUBLIC_ORIGIN: origin,
            })).toBe('https://localhost:3000');
        }
    });
});
