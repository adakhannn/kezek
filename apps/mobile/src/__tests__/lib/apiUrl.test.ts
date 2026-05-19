describe('apiUrl resolver', () => {
    const originalEnv = { ...process.env };
    const originalDev = (global as { __DEV__?: boolean }).__DEV__;

    afterEach(() => {
        process.env = { ...originalEnv };
        (global as { __DEV__?: boolean }).__DEV__ = originalDev;
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('uses EXPO_PUBLIC_API_URL when provided', () => {
        process.env.EXPO_PUBLIC_API_URL = 'https://staging.kezek.kg/';
        process.env.NODE_ENV = 'production';
        (global as { __DEV__?: boolean }).__DEV__ = false;

        jest.doMock('expo-constants', () => ({
            default: { expoConfig: { extra: {} } },
        }));

        jest.isolateModules(() => {
            const { resolveMobileApiUrl } = require('../../lib/apiUrl');
            expect(resolveMobileApiUrl()).toBe('https://staging.kezek.kg');
        });
    });

    test('falls back to prod api url in test env when config is missing', () => {
        delete process.env.EXPO_PUBLIC_API_URL;
        process.env.NODE_ENV = 'test';
        (global as { __DEV__?: boolean }).__DEV__ = true;

        jest.doMock('expo-constants', () => ({
            default: { expoConfig: { extra: {} } },
        }));

        jest.isolateModules(() => {
            const { resolveMobileApiUrl, PROD_API_URL } = require('../../lib/apiUrl');
            expect(resolveMobileApiUrl()).toBe(PROD_API_URL);
        });
    });

    test('throws in non-production app env when config is missing', () => {
        delete process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_APP_ENV = 'staging';
        process.env.NODE_ENV = 'production';
        (global as { __DEV__?: boolean }).__DEV__ = false;

        jest.doMock('expo-constants', () => ({
            default: { expoConfig: { extra: {} } },
        }));

        jest.isolateModules(() => {
            const { resolveMobileApiUrl } = require('../../lib/apiUrl');
            expect(() => resolveMobileApiUrl()).toThrow(
                'Missing API URL config for non-production build',
            );
        });
    });
});
