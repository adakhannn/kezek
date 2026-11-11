import { POST, GET } from '@/app/api/auth/mobile-exchange/route';
import { hashMobileExchangeSecret, issueMobileSessionGrant } from '@/lib/mobileExchangeService';
import { issueSessionForVerifiedUser } from '@/lib/verifiedIdentitySession';
import { telegramAttemptPersistence } from '@/__tests__/fixtures/telegramAttemptPersistence';
import { setupApiTestMocks, createMockNextRequest, expectErrorResponse, expectSuccessResponse } from '../testHelpers';
setupApiTestMocks();
// Limiter has its own tests; isolate this contract from cross-test IP counters.
jest.mock('@/lib/rateLimit', () => ({
    ...jest.requireActual('@/lib/rateLimit'),
    withRateLimit: (_request: unknown, _config: unknown, handler: () => unknown) => handler(),
}));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: () => jest.requireActual('@/__tests__/fixtures/telegramAttemptPersistence').telegramAttemptPersistence.client }));
jest.mock('@/lib/verifiedIdentitySession', () => ({ issueSessionForVerifiedUser: jest.fn(async () => ({ accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' })) }));
const verifier = 'v'.repeat(64);
const userId = '00000000-0000-4000-8000-000000000001';
const post = (body: unknown) => POST(createMockNextRequest('http://localhost/api/auth/mobile-exchange', { method: 'POST', body }));
beforeEach(() => { telegramAttemptPersistence.reset(); jest.clearAllMocks(); });

describe('/api/auth/mobile-exchange bound grant contract', () => {
    test.each(['', '?check=true', '?code=legacy'])('GET %s is retired and reveals no session or discovery data', async query => {
        const response = await Reflect.apply(GET, undefined, [createMockNextRequest('http://localhost/api/auth/mobile-exchange' + query)]);
        const data = await expectErrorResponse(response, 410, 'gone');
        expect(data).not.toHaveProperty('data');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(issueSessionForVerifiedUser).not.toHaveBeenCalled();
    });
    test.each([{ accessToken: 'uploaded-access', refreshToken: 'uploaded-refresh' }, { code: 'legacy' }, { code: 'a'.repeat(43), codeVerifier: '' }, { code: 'a'.repeat(43), codeVerifier: verifier, userId: 'other' }])('rejects token ingress or malformed proof', async body => {
        await expectErrorResponse(await post(body), 400, 'validation');
        expect(issueSessionForVerifiedUser).not.toHaveBeenCalled();
    });
    test('wrong verifier cannot claim a grant; the initiating verifier succeeds once', async () => {
        const { code } = await issueMobileSessionGrant({ userId, codeChallenge: hashMobileExchangeSecret(verifier) });
        await expectErrorResponse(await post({ code, codeVerifier: 'x'.repeat(64) }), 400, 'invalid_grant');
        expect(issueSessionForVerifiedUser).not.toHaveBeenCalled();
        const response = await post({ code, codeVerifier: verifier });
        const body = await expectSuccessResponse(response);
        expect(body).toMatchObject({ data: { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' } });
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expectErrorResponse(await post({ code, codeVerifier: verifier }), 400, 'invalid_grant');
        expect(issueSessionForVerifiedUser).toHaveBeenCalledTimes(1);
        expect(issueSessionForVerifiedUser).toHaveBeenCalledWith(userId);
    });
});
