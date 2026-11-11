import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/** Auth-js otherwise falls back to Math.random/plain PKCE on native platforms. */
export function installNativeAuthCrypto() {
    if (Platform.OS === 'web') return;
    const target = globalThis as unknown as { crypto?: Record<string, unknown> };
    target.crypto ??= {};
    target.crypto.getRandomValues ??= Crypto.getRandomValues;
    target.crypto.subtle ??= { digest: Crypto.digest };
}

export async function createMobileAuthProof() {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const codeVerifier = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const codeChallenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier);
    return { codeVerifier, codeChallenge };
}
