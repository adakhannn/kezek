import appConfig, { backendExtra, PRODUCTION_BACKEND, resolveAppEnv, sentryPlugins } from '../../app.config';

describe('app.config backend selection (MOB-06)', () => {
    test('only a production build defaults to the production backend', () => {
        expect(backendExtra({ EAS_BUILD_PROFILE: 'production' })).toEqual({ appEnv: 'production', ...PRODUCTION_BACKEND });
        expect(backendExtra({ APP_ENV: 'production' }).supabaseUrl).toBe(PRODUCTION_BACKEND.supabaseUrl);
        for (const env of [{}, { EAS_BUILD_PROFILE: 'development' }, { APP_ENV: 'preview' }, { EAS_BUILD_PROFILE: 'preview' }]) {
            expect(backendExtra(env)).toEqual({
                appEnv: resolveAppEnv(env),
                supabaseUrl: undefined,
                supabaseAnonKey: undefined,
                apiUrl: undefined,
            });
        }
    });

    test('EXPO_PUBLIC_* variables choose the backend in every build', () => {
        const env = {
            APP_ENV: 'preview',
            EXPO_PUBLIC_SUPABASE_URL: 'http://192.168.0.10:54321',
            EXPO_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
            EXPO_PUBLIC_API_URL: 'http://192.168.0.10:3000',
        };
        expect(backendExtra(env)).toEqual({
            appEnv: 'preview',
            supabaseUrl: 'http://192.168.0.10:54321',
            supabaseAnonKey: 'local-anon-key',
            apiUrl: 'http://192.168.0.10:3000',
        });
        expect(backendExtra({ ...env, APP_ENV: 'production' }).supabaseUrl).toBe('http://192.168.0.10:54321');
    });

    test('the build environment comes from EXPO_PUBLIC_APP_ENV, APP_ENV or the EAS profile', () => {
        expect(resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'Production' })).toBe('production');
        expect(resolveAppEnv({ EAS_BUILD_PROFILE: 'preview' })).toBe('preview');
        expect(resolveAppEnv({ APP_ENV: 'staging' })).toBe('development');
        expect(resolveAppEnv({})).toBe('development');
    });

    test('keeps the static app.json config and adds the backend to extra', () => {
        const result = appConfig({ config: { name: 'Kezek', slug: 'kezek-mobile', extra: { eas: { projectId: 'x' } } } } as never);
        expect(result.name).toBe('Kezek');
        expect(result.extra).toMatchObject({ eas: { projectId: 'x' } });
        expect(result.extra).toHaveProperty('appEnv');
    });
});

describe('app.config Sentry uploads (MOB-07)', () => {
    test('the upload plugin needs both an organization and a project', () => {
        expect(sentryPlugins({})).toEqual([]);
        expect(sentryPlugins({ SENTRY_ORG: 'kezek' })).toEqual([]);
        expect(sentryPlugins({ SENTRY_ORG: ' kezek ', SENTRY_PROJECT: ' mobile ' })).toEqual([
            ['@sentry/react-native/expo', { organization: 'kezek', project: 'mobile' }],
        ]);
    });

    test('app.json plugins are kept', () => {
        const result = appConfig({ config: { name: 'Kezek', slug: 'kezek-mobile', plugins: ['expo-secure-store'] } } as never);
        expect(result.plugins?.[0]).toBe('expo-secure-store');
    });
});

describe('app.json native strings per language (C6)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appJson = require('../../app.json') as { expo: { locales?: Record<string, string>; ios?: { infoPlist?: Record<string, unknown> } } };

    test('the iOS location permission text and app name exist in ru, ky and en', () => {
        expect(Object.keys(appJson.expo.locales ?? {}).sort()).toEqual(['en', 'ky', 'ru']);
        expect(appJson.expo.ios?.infoPlist?.CFBundleAllowMixedLocalizations).toBe(true);
        for (const file of Object.values(appJson.expo.locales ?? {})) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const strings = require(`../../${file.replace('./', '')}`) as Record<string, string>;
            expect(strings.CFBundleDisplayName).toBe('Kezek');
            expect(strings.NSLocationWhenInUseUsageDescription).toMatch(/\S/);
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        expect((require('../../locales/ky.json') as Record<string, string>).NSLocationWhenInUseUsageDescription).toContain('геолокацияны');
    });
});
