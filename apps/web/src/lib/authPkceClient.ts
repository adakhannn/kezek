/** The verifier stays in the initiating browser; only its SHA-256 challenge is sent at start. */
export async function createAuthProof() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const codeVerifier = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return { codeVerifier, codeChallenge };
}
