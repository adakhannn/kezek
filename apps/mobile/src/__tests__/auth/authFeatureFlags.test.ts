describe('authFeatureFlags', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    const loadFlags = () =>
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../../screens/auth/hooks/authFeatureFlags') as {
            MOBILE_GOOGLE_NATIVE_AUTH_ENABLED: boolean;
            TELEGRAM_DEEPLINK_AUTH_ENABLED: boolean;
            WHATSAPP_MOBILE_AUTH_ENABLED: boolean;
        };

    test('uses defaults when env flags are undefined', () => {
        delete process.env.EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH;
        delete process.env.EXPO_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH;
        delete process.env.EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH;

        const mod = loadFlags();
        expect(mod.MOBILE_GOOGLE_NATIVE_AUTH_ENABLED).toBe(true);
        expect(mod.TELEGRAM_DEEPLINK_AUTH_ENABLED).toBe(true);
        expect(mod.WHATSAPP_MOBILE_AUTH_ENABLED).toBe(true);
    });

    test('parses explicit false values', () => {
        process.env.EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH = 'false';
        process.env.EXPO_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH = 'off';
        process.env.EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH = '0';

        const mod = loadFlags();
        expect(mod.MOBILE_GOOGLE_NATIVE_AUTH_ENABLED).toBe(false);
        expect(mod.TELEGRAM_DEEPLINK_AUTH_ENABLED).toBe(false);
        expect(mod.WHATSAPP_MOBILE_AUTH_ENABLED).toBe(false);
    });

    test('parses explicit true values', () => {
        process.env.EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH = 'enabled';
        process.env.EXPO_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH = 'yes';
        process.env.EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH = '1';

        const mod = loadFlags();
        expect(mod.MOBILE_GOOGLE_NATIVE_AUTH_ENABLED).toBe(true);
        expect(mod.TELEGRAM_DEEPLINK_AUTH_ENABLED).toBe(true);
        expect(mod.WHATSAPP_MOBILE_AUTH_ENABLED).toBe(true);
    });
});
