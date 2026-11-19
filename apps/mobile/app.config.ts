import type { ConfigContext, ExpoConfig } from 'expo/config';

// The production backend. Only production builds fall back to it: development and preview builds and
// `expo start` must name their backend in EXPO_PUBLIC_* variables (apps/mobile/.env.example), so a test
// build never writes bookings into production by accident. The anon key is the public client key.
// kezek.kg was lost to a third party in November 2026: never point builds there.
export const PRODUCTION_BACKEND = {
    supabaseUrl: 'https://beulnmftzbmtbdlgurht.supabase.co',
    supabaseAnonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldWxubWZ0emJtdGJkbGd1cmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTMwMjYsImV4cCI6MjA3MDU2OTAyNn0.3P9TqjuJv6FKviacU_yQZu8TzXFh7eqVEZilDg6rEko',
    apiUrl: 'https://kezek.vercel.app',
};

export type AppEnv = 'production' | 'preview' | 'development';

/** EAS sets EAS_BUILD_PROFILE; eas.json also passes APP_ENV. Anything else is a development build. */
export function resolveAppEnv(env: Record<string, string | undefined> = process.env): AppEnv {
    const value = (env.EXPO_PUBLIC_APP_ENV || env.APP_ENV || env.EAS_BUILD_PROFILE || '').trim().toLowerCase();
    if (value === 'production') return 'production';
    if (value === 'preview') return 'preview';
    return 'development';
}

export function backendExtra(env: Record<string, string | undefined> = process.env) {
    const appEnv = resolveAppEnv(env);
    const defaults: Partial<typeof PRODUCTION_BACKEND> = appEnv === 'production' ? PRODUCTION_BACKEND : {};
    return {
        appEnv,
        supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL || defaults.supabaseUrl,
        supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY || defaults.supabaseAnonKey,
        apiUrl: env.EXPO_PUBLIC_API_URL || defaults.apiUrl,
    };
}

/**
 * The Sentry plugin uploads source maps and native debug files during EAS builds (MOB-07). It needs an
 * organization and a project here and SENTRY_AUTH_TOKEN as an EAS secret; without them a build carries
 * the SDK, reports with EXPO_PUBLIC_SENTRY_DSN and uploads nothing.
 */
export function sentryPlugins(env: Record<string, string | undefined> = process.env): NonNullable<ExpoConfig['plugins']> {
    const organization = env.SENTRY_ORG?.trim();
    const project = env.SENTRY_PROJECT?.trim();
    return organization && project ? [['@sentry/react-native/expo', { organization, project }]] : [];
}

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: config.name ?? 'Kezek',
    slug: config.slug ?? 'kezek-mobile',
    plugins: [...(config.plugins ?? []), ...sentryPlugins()],
    extra: { ...config.extra, ...backendExtra() },
});
