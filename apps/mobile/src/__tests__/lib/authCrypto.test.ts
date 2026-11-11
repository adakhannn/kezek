import * as Crypto from 'expo-crypto';
import { createMobileAuthProof, installNativeAuthCrypto } from '../../lib/authCrypto';

test('creates an independent high entropy verifier with its SHA256 challenge', async () => {
    const first = await createMobileAuthProof();
    const second = await createMobileAuthProof();
    expect(first.codeVerifier).toMatch(/^[a-f0-9]{64}$/);
    expect(first.codeChallenge).toMatch(/^[a-f0-9]{64}$/);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(Crypto.CryptoDigestAlgorithm.SHA256, first.codeVerifier);
});

test('installs secure random and SHA256 for native Supabase PKCE', () => {
    installNativeAuthCrypto();
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
    expect(typeof globalThis.crypto.subtle.digest).toBe('function');
});
