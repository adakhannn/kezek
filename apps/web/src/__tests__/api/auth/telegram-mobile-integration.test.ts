jest.mock('@/lib/telegramLoginService', () => ({
    handleTelegramLogin: jest.fn(),
}));
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

import { POST as startPOST } from '@/app/api/auth/telegram/mobile/start/route';
import { GET as statusGET } from '@/app/api/auth/telegram/mobile/status/route';
import { POST as confirmPOST } from '@/app/api/auth/telegram/mobile/confirm/route';
import { POST as callbackPOST } from '@/app/api/auth/telegram/mobile/callback/route';
import { GET as mobileExchangeGET } from '@/app/api/auth/mobile-exchange/route';
import { __resetMobileExchangeStoreForTests } from '@/lib/mobileExchangeService';
import { __resetTelegramMobileBotRequestReplayStoreForTests } from '@/lib/telegramMobileBotRequestAuth';
import { __resetNonceProbeProtectionForTests } from '@/lib/telegramMobileNonceProbeProtection';
import { __resetTelegramMobileAuthAttemptsForTests } from '@/lib/telegramMobileAuthAttemptService';
import { handleTelegramLogin } from '@/lib/telegramLoginService';
import {
    createMockNextRequest,
    createMockRequest,
    createTelegramMobileSignedHeaders,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

describe('Telegram mobile auth integration', () => {
    const previousSecret = process.env.TELEGRAM_MOBILE_BOT_SECRET;
    const mockedCreateClient = createClient as unknown as jest.Mock;
    const mockedHandleTelegramLogin = handleTelegramLogin as jest.MockedFunction<
        typeof handleTelegramLogin
    >;

    beforeEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        __resetTelegramMobileAuthAttemptsForTests();
        __resetTelegramMobileBotRequestReplayStoreForTests();
        __resetNonceProbeProtectionForTests();
        __resetMobileExchangeStoreForTests();

        mockedHandleTelegramLogin.mockReset();
        mockedHandleTelegramLogin.mockResolvedValue({
            ok: true,
            data: {
                userId: 'user-1',
                email: 'telegram_12345@telegram.local',
                password: 'password-1',
                needsSignIn: true,
                redirect: '/',
                linkage: 'existing',
            },
        });

        const authClient = {
            auth: {
                signInWithPassword: jest.fn().mockResolvedValue({
                    data: {
                        session: {
                            access_token: 'access-token',
                            refresh_token: 'refresh-token',
                        },
                    },
                    error: null,
                }),
            },
        };
        const adminClient = {
            auth: {
                admin: {},
            },
        };

        mockedCreateClient.mockReset();
        mockedCreateClient.mockImplementation((_: string, key: string) => {
            if (key === process.env.SUPABASE_SERVICE_ROLE_KEY) {
                return adminClient;
            }
            return authClient;
        });
    });

    afterEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = previousSecret;
    });

    test('happy-path: start -> approve -> status approved -> mobile session exchange', async () => {
        const startRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            {
                method: 'POST',
                body: {
                    appName: 'Kezek Mobile',
                    device: 'Pixel 8',
                    platform: 'android',
                },
            },
        );
        const startResponse = await startPOST(startRequest);
        const startData = await expectSuccessResponse(startResponse, 200);
        const nonce = (startData as { data: { nonce: string } }).data.nonce;

        const callbackBody = {
            nonce,
            telegram_id: 12345,
            decision: 'approve',
            username: 'tg_user',
        };
        const callbackRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body: callbackBody,
                    requestId: 'integration-approve-1',
                }),
                body: callbackBody,
            },
        );
        const callbackResponse = await callbackPOST(callbackRequest);
        await expectSuccessResponse(callbackResponse, 200);

        const statusRequest = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(nonce)}`,
            { method: 'GET' },
        );
        const statusResponse = await statusGET(statusRequest);
        const statusData = await expectSuccessResponse(statusResponse, 200);

        expect(statusData).toHaveProperty('data.status', 'approved');
        const exchangeCode = (
            statusData as { data: { exchangeCode: string } }
        ).data.exchangeCode;
        expect(typeof exchangeCode).toBe('string');

        const exchangeRequest = createMockNextRequest(
            `http://localhost/api/auth/mobile-exchange?code=${exchangeCode}`,
            { method: 'GET' },
        );
        const exchangeResponse = await mobileExchangeGET(exchangeRequest);
        const exchangeData = await expectSuccessResponse(exchangeResponse, 200);

        expect(exchangeData).toHaveProperty('data.accessToken', 'access-token');
        expect(exchangeData).toHaveProperty('data.refreshToken', 'refresh-token');
    });

    test('idempotent repeated confirm click returns approved and does not re-run login', async () => {
        const startRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            { method: 'POST' },
        );
        const startResponse = await startPOST(startRequest);
        const startData = await expectSuccessResponse(startResponse, 200);
        const nonce = (startData as { data: { nonce: string } }).data.nonce;

        const body = {
            nonce,
            telegram_id: 12345,
        };

        const firstConfirmRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                    requestId: 'integration-confirm-1',
                }),
                body,
            },
        );
        const firstConfirmResponse = await confirmPOST(firstConfirmRequest);
        const firstData = await expectSuccessResponse(firstConfirmResponse, 200);
        expect(firstData).toHaveProperty('data.status', 'approved');

        const secondConfirmRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                    requestId: 'integration-confirm-2',
                }),
                body,
            },
        );
        const secondConfirmResponse = await confirmPOST(secondConfirmRequest);
        const secondData = await expectSuccessResponse(secondConfirmResponse, 200);
        expect(secondData).toHaveProperty('data.status', 'approved');

        expect(mockedHandleTelegramLogin).toHaveBeenCalledTimes(1);
    });

    test('handles race conditions and network retries', async () => {
        const startRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            { method: 'POST' },
        );
        const startResponse = await startPOST(startRequest);
        const startData = await expectSuccessResponse(startResponse, 200);
        const nonce = (startData as { data: { nonce: string } }).data.nonce;

        const confirmBody = {
            nonce,
            telegram_id: 12345,
        };

        const confirmRequestA = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body: confirmBody,
                    requestId: 'integration-race-1',
                }),
                body: confirmBody,
            },
        );
        const confirmRequestB = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body: confirmBody,
                    requestId: 'integration-race-2',
                }),
                body: confirmBody,
            },
        );

        const [confirmResponseA, confirmResponseB] = await Promise.all([
            confirmPOST(confirmRequestA),
            confirmPOST(confirmRequestB),
        ]);

        const sortedConfirmStatuses = [
            confirmResponseA.status,
            confirmResponseB.status,
        ].sort((a, b) => a - b);
        expect(sortedConfirmStatuses).toEqual([200, 409]);

        const statusRequest = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(nonce)}`,
            { method: 'GET' },
        );
        const statusResponse = await statusGET(statusRequest);
        const statusData = await expectSuccessResponse(statusResponse, 200);
        expect(statusData).toHaveProperty('data.status', 'approved');
        const exchangeCode = (
            statusData as { data: { exchangeCode: string } }
        ).data.exchangeCode;

        const exchangeRequestA = createMockNextRequest(
            `http://localhost/api/auth/mobile-exchange?code=${exchangeCode}`,
            { method: 'GET' },
        );
        const exchangeRequestB = createMockNextRequest(
            `http://localhost/api/auth/mobile-exchange?code=${exchangeCode}`,
            { method: 'GET' },
        );
        const [exchangeResponseA, exchangeResponseB] = await Promise.all([
            mobileExchangeGET(exchangeRequestA),
            mobileExchangeGET(exchangeRequestB),
        ]);

        const sortedExchangeStatuses = [
            exchangeResponseA.status,
            exchangeResponseB.status,
        ].sort((a, b) => a - b);
        expect(sortedExchangeStatuses).toEqual([200, 409]);

        const conflictResponse =
            exchangeResponseA.status === 409 ? exchangeResponseA : exchangeResponseB;
        await expectErrorResponse(conflictResponse, 409, 'conflict');
    });
});
