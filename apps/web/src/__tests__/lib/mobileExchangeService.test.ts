import { hashMobileExchangeSecret, issueMobileSessionGrant, redeemMobileSessionGrant, type MobileExchangeRepository } from '@/lib/mobileExchangeService';

const userId = '00000000-0000-4000-8000-000000000001';
const codeVerifier = 'v'.repeat(64);
function fixture() {
    const grants = new Map<string, { codeChallenge: string; userId: string }>();
    const store: MobileExchangeRepository = {
        issue: jest.fn(async grant => { grants.set(grant.codeHash, grant); }),
        consume: jest.fn(async (hash, challenge) => {
            const grant = grants.get(hash);
            if (!grant || grant.codeChallenge !== challenge) return null;
            grants.delete(hash);
            return grant.userId;
        }),
    };
    const issueSession = jest.fn(async () => ({ accessToken: 'access', refreshToken: 'refresh' }));
    return { grants, store, issueSession };
}
describe('bound mobile session grants', () => {
    test('persists only the hash, challenge and verified identity', async () => {
        const { store } = fixture();
        const { code } = await issueMobileSessionGrant({ userId, codeChallenge: hashMobileExchangeSecret(codeVerifier) }, store);
        expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(store.issue).toHaveBeenCalledWith({ userId, codeHash: hashMobileExchangeSecret(code), codeChallenge: hashMobileExchangeSecret(codeVerifier) });
        expect(JSON.stringify((store.issue as jest.Mock).mock.calls)).not.toContain(code);
    });
    test('wrong verifier cannot consume the grant; owner can redeem only once', async () => {
        const deps = fixture();
        const { code } = await issueMobileSessionGrant({ userId, codeChallenge: hashMobileExchangeSecret(codeVerifier) }, deps.store);
        expect(await redeemMobileSessionGrant({ code, codeVerifier: 'x'.repeat(64) }, deps)).toMatchObject({ ok: false, error: 'invalid_grant' });
        expect(deps.issueSession).not.toHaveBeenCalled();
        expect(await redeemMobileSessionGrant({ code, codeVerifier }, deps)).toEqual({ ok: true, payload: { accessToken: 'access', refreshToken: 'refresh' } });
        expect(await redeemMobileSessionGrant({ code, codeVerifier }, deps)).toMatchObject({ ok: false, error: 'invalid_grant' });
        expect(deps.issueSession).toHaveBeenCalledTimes(1);
        expect(deps.issueSession).toHaveBeenCalledWith(userId);
    });
    test('unknown and expired grants never invoke Auth', async () => {
        const deps = fixture();
        expect(await redeemMobileSessionGrant({ code: 'a'.repeat(43), codeVerifier }, deps)).toMatchObject({ ok: false, error: 'invalid_grant' });
        expect(deps.issueSession).not.toHaveBeenCalled();
    });
    test('burns the grant on session issuer failure instead of allowing replay', async () => {
        const deps = fixture();
        const { code } = await issueMobileSessionGrant({ userId, codeChallenge: hashMobileExchangeSecret(codeVerifier) }, deps.store);
        deps.issueSession.mockRejectedValueOnce(new Error('Auth unavailable'));
        await expect(redeemMobileSessionGrant({ code, codeVerifier }, deps)).rejects.toThrow('Auth unavailable');
        expect(await redeemMobileSessionGrant({ code, codeVerifier }, deps)).toMatchObject({ ok: false, error: 'invalid_grant' });
        expect(deps.issueSession).toHaveBeenCalledTimes(1);
    });
    test.each([{ code: 'abc123', codeVerifier }, { code: 'a'.repeat(43), codeVerifier: '' }, { code: null, codeVerifier }])('rejects malformed proof before persistence', async input => {
        const deps = fixture();
        expect(await redeemMobileSessionGrant(input, deps)).toMatchObject({ ok: false, status: 400 });
        expect(deps.store.consume).not.toHaveBeenCalled();
    });
});
