import { DELETE, POST } from '@/app/api/mobile/push-tokens/route';
import { createMockRequest, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/mobileBookingAuthService', () => ({ resolveMobileBookingAuth: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn(() => ({ synthetic: 'service-client' })) }));
jest.mock('@/lib/pushTokens', () => ({
    ...jest.requireActual('@/lib/pushTokens'),
    registerPushToken: jest.fn(), unregisterPushToken: jest.fn(),
}));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn(), logInfo: jest.fn() }));

import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { registerPushToken, unregisterPushToken } from '@/lib/pushTokens';

const URL = 'http://localhost/api/mobile/push-tokens';
const TOKEN = 'ExponentPushToken[synthetic-install-0001]';
const signedIn = () => jest.mocked(resolveMobileBookingAuth).mockResolvedValue({ ok: true, client: {} as never, user: { id: 'user-1' } });
const signedOut = () => jest.mocked(resolveMobileBookingAuth).mockResolvedValueOnce({ ok: false, error: 'auth', message: 'Not signed in', status: 401 });

beforeEach(() => { jest.clearAllMocks(); });

describe('POST /api/mobile/push-tokens', () => {
    test('401 without a session; nothing is written', async () => {
        signedOut();
        await expectErrorResponse(await POST(createMockRequest(URL, { method: 'POST', body: { token: TOKEN, platform: 'ios' } })), 401, 'auth');
        expect(registerPushToken).not.toHaveBeenCalled();
    });

    test('registers the token for the signed-in user through the service client', async () => {
        signedIn();
        const res = await POST(createMockRequest(URL, { method: 'POST', headers: { Authorization: 'Bearer synthetic' },
            body: { token: TOKEN, platform: 'android', deviceName: ' Pixel ' } }));
        expect((await expectSuccessResponse(res, 200)).data).toEqual({ registered: true });
        expect(registerPushToken).toHaveBeenCalledWith({ synthetic: 'service-client' }, 'user-1', { token: TOKEN, platform: 'android', deviceName: 'Pixel' });
    });

    test('the older ExpoPushToken form is accepted', async () => {
        signedIn();
        await expectSuccessResponse(await POST(createMockRequest(URL, { method: 'POST', body: { token: 'ExpoPushToken[synthetic-install-0002]', platform: 'ios' } })), 200);
    });

    test.each([
        [{ token: 'not-a-token', platform: 'ios' }],
        [{ token: TOKEN, platform: 'web' }],
        [{ token: 'ExponentPushToken[]', platform: 'ios' }],
        [{ platform: 'ios' }],
        [{ token: TOKEN, platform: 'ios', deviceName: 'x'.repeat(101) }],
    ])('400 for %j without echoing the value', async body => {
        signedIn();
        const res = await POST(createMockRequest(URL, { method: 'POST', body }));
        const json = await expectErrorResponse(res, 400, 'validation');
        expect(JSON.stringify(json)).not.toContain('not-a-token');
        expect(registerPushToken).not.toHaveBeenCalled();
    });

    test('400 for a body that is not JSON', async () => {
        signedIn();
        await expectErrorResponse(await POST(createMockRequest(URL, { method: 'POST', body: '{' })), 400, 'validation');
    });

    test('a store failure is a 500 without the token in the answer', async () => {
        signedIn();
        jest.mocked(registerPushToken).mockRejectedValue(new Error('PUSH_TOKEN_REGISTER_FAILED'));
        const res = await POST(createMockRequest(URL, { method: 'POST', body: { token: TOKEN, platform: 'ios' } }));
        const json = await expectErrorResponse(res, 500, 'internal');
        expect(JSON.stringify(json)).not.toContain('synthetic-install');
    });
});

describe('DELETE /api/mobile/push-tokens', () => {
    test("removes only the signed-in user's token", async () => {
        signedIn();
        const res = await DELETE(createMockRequest(URL, { method: 'DELETE', body: { token: TOKEN } }));
        expect((await expectSuccessResponse(res, 200)).data).toEqual({ registered: false });
        expect(unregisterPushToken).toHaveBeenCalledWith({ synthetic: 'service-client' }, 'user-1', TOKEN);
    });

    test('401 without a session and 400 for an invalid token', async () => {
        signedOut();
        await expectErrorResponse(await DELETE(createMockRequest(URL, { method: 'DELETE', body: { token: TOKEN } })), 401, 'auth');
        signedIn();
        await expectErrorResponse(await DELETE(createMockRequest(URL, { method: 'DELETE', body: { token: 'x' } })), 400, 'validation');
        expect(unregisterPushToken).not.toHaveBeenCalled();
    });
});
