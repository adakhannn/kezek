import { Platform } from 'react-native';

export type AppleAuthenticationModule = typeof import('expo-apple-authentication');

/**
 * Sign in with Apple exists only on iOS. The module is required lazily: an over-the-air bundle that
 * runs on an older binary without the native module must hide the button, not crash on import.
 */
export function loadAppleAuthentication(): AppleAuthenticationModule | null {
    if (Platform.OS !== 'ios') return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('expo-apple-authentication') as AppleAuthenticationModule;
    } catch {
        return null;
    }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
    const module = loadAppleAuthentication();
    if (!module) return false;
    try {
        return await module.isAvailableAsync();
    } catch {
        return false;
    }
}

/** The user closed Apple's sheet: no error message is shown. */
export function isAppleSignInCancel(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED');
}

type AppleFullName = {
    givenName?: string | null;
    middleName?: string | null;
    familyName?: string | null;
    nickname?: string | null;
} | null | undefined;

/** Apple sends the name only on the first sign-in; null when the user shared none. */
export function appleFullNameToMetadata(fullName: AppleFullName) {
    const given = fullName?.givenName?.trim() || '';
    const middle = fullName?.middleName?.trim() || '';
    const family = fullName?.familyName?.trim() || '';
    const full = [given, middle, family].filter(Boolean).join(' ');
    if (!full) return null;
    return {
        full_name: full,
        name: full,
        ...(given ? { given_name: given } : {}),
        ...(family ? { family_name: family } : {}),
    };
}
