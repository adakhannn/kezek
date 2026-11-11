import { createHash, randomBytes } from 'crypto';

import { getServiceClient } from '@/lib/supabaseService';
import { issueSessionForVerifiedUser } from '@/lib/verifiedIdentitySession';

export const MOBILE_CODE_CHALLENGE_RE = /^[a-f0-9]{64}$/;
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
const CODE_RE = /^[A-Za-z0-9_-]{43}$/;
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hashMobileExchangeSecret = (value: string) => createHash('sha256').update(value).digest('hex');

type Tokens = { accessToken: string; refreshToken: string };
export type MobileExchangeRepository = {
    issue: (grant: { codeHash: string; codeChallenge: string; userId: string }) => Promise<void>;
    consume: (codeHash: string, codeChallenge: string) => Promise<string | null>;
};

const repository: MobileExchangeRepository = {
    async issue(grant) {
        const { error } = await getServiceClient().rpc('create_mobile_session_grant', {
            p_code_hash: grant.codeHash,
            p_code_challenge: grant.codeChallenge,
            p_user_id: grant.userId,
        });
        if (error) throw new Error('Mobile sign-in storage unavailable');
    },
    async consume(codeHash, codeChallenge) {
        const { data, error } = await getServiceClient().rpc('consume_mobile_session_grant', {
            p_code_hash: codeHash,
            p_code_challenge: codeChallenge,
        });
        if (error) throw new Error('Mobile sign-in storage unavailable');
        return typeof data === 'string' ? data : null;
    },
};

/** Server-only: call after independently verifying the provider identity.
 * The challenge must come from the initiating attempt, never the approval request. */
export async function issueMobileSessionGrant(
    { userId, codeChallenge }: { userId: string; codeChallenge: string },
    store: MobileExchangeRepository = repository,
) {
    if (!USER_ID_RE.test(userId) || !MOBILE_CODE_CHALLENGE_RE.test(codeChallenge)) {
        throw new Error('Invalid mobile sign-in binding');
    }
    const code = randomBytes(32).toString('base64url');
    await store.issue({ codeHash: hashMobileExchangeSecret(code), codeChallenge, userId });
    return { code };
}

export async function redeemMobileSessionGrant(
    { code, codeVerifier }: { code: unknown; codeVerifier: unknown },
    deps: { store?: MobileExchangeRepository; issueSession?: (userId: string) => Promise<Tokens> } = {},
) {
    if (typeof code !== 'string' || !CODE_RE.test(code) ||
        typeof codeVerifier !== 'string' || !VERIFIER_RE.test(codeVerifier)) {
        return { ok: false as const, status: 400, error: 'validation', message: 'Начните вход заново в приложении.' };
    }
    const userId = await (deps.store ?? repository).consume(
        hashMobileExchangeSecret(code), hashMobileExchangeSecret(codeVerifier),
    );
    // Wrong verifier, expired, unknown and replay deliberately indistinguishable.
    if (!userId) return { ok: false as const, status: 400, error: 'invalid_grant', message: 'Запрос входа недоступен. Начните заново.' };
    const payload = await (deps.issueSession ?? issueSessionForVerifiedUser)(userId);
    return { ok: true as const, payload };
}
