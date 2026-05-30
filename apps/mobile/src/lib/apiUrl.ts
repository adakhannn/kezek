import Constants from 'expo-constants';

const PROD_API_URL = 'https://kezek.kg';

function normalizeApiUrl(value: string): string {
    return value.trim().replace(/\/+$/, '');
}

function isValidApiUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.host;
    } catch {
        return false;
    }
}

function isNonProdAppEnv(envValue: string | undefined): boolean {
    if (!envValue) {
        return false;
    }

    const normalized = envValue.trim().toLowerCase();
    return (
        normalized === 'dev' ||
        normalized === 'development' ||
        normalized === 'stage' ||
        normalized === 'staging' ||
        normalized === 'test'
    );
}

export function resolveMobileApiUrl(): string {
    const fromPublicEnv = process.env.EXPO_PUBLIC_API_URL;
    const fromExpoExtra = Constants.expoConfig?.extra?.apiUrl;
    const fromNodeEnv = process.env.NODE_ENV;
    const fromAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

    const configured = fromPublicEnv || fromExpoExtra;
    if (configured && String(configured).trim()) {
        const normalized = normalizeApiUrl(String(configured));
        if (!isValidApiUrl(normalized)) {
            throw new Error(
                'Invalid API URL config. Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl to a valid http(s) URL.',
            );
        }
        return normalized;
    }

    if (fromNodeEnv === 'test') {
        return PROD_API_URL;
    }

    const strictNonProd = __DEV__ || isNonProdAppEnv(fromAppEnv);
    if (strictNonProd) {
        throw new Error(
            'Missing API URL config for non-production build. Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl.',
        );
    }

    return PROD_API_URL;
}

export function getMobileApiUrl(): string {
    return resolveMobileApiUrl();
}

export { PROD_API_URL };
