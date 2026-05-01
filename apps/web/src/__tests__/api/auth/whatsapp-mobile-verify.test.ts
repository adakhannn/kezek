import { runWhatsAppMobileVerifyHttp } from '@/lib/whatsAppMobileVerifyHttpService';
import { __resetWhatsAppMobileIdempotencyForTests } from '@/lib/whatsAppMobileAuthIdempotency';
import { __resetWhatsAppMobileAbuseProtectionForTests } from '@/lib/whatsAppMobileAbuseProtection';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(() => ({})),
}));

jest.mock('@/lib/rateLimit', () => ({
    getRateLimitIdentifier: jest.fn(() => 'ip:test'),
}));

jest.mock('@/lib/whatsAppMobileVerifyRouteService', () => ({
    runWhatsAppMobileVerifyRoute: jest.fn(),
}));

import { runWhatsAppMobileVerifyRoute } from '@/lib/whatsAppMobileVerifyRouteService';

describe('runWhatsAppMobileVerifyHttp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetWhatsAppMobileIdempotencyForTests();
        __resetWhatsAppMobileAbuseProtectionForTests();
    });

    test('returns verify payload on success', async () => {
        (runWhatsAppMobileVerifyRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                status: 'approved',
                attemptId: 'attempt-1',
                exchangeCode: 'exchange-1',
                expiresAt: '2026-05-01T10:00:00.000Z',
                userId: 'user-1',
                linkage: 'existing',
            },
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            body: { attemptId: 'attempt-1', code: '123456', phone: '+996500574029' },
        });

        const res = await runWhatsAppMobileVerifyHttp(req);
        const data = await expectSuccessResponse(res, 200);
        expect(data).toHaveProperty('status', 'approved');
        expect(data).toHaveProperty('exchangeCode', 'exchange-1');
    });

    test('maps invalid code error', async () => {
        (runWhatsAppMobileVerifyRoute as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid code',
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            body: { attemptId: 'attempt-1', code: '000000' },
        });

        const res = await runWhatsAppMobileVerifyHttp(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('maps expired and consumed scenarios', async () => {
        (runWhatsAppMobileVerifyRoute as jest.Mock)
            .mockResolvedValueOnce({
                ok: false,
                status: 410,
                error: 'validation',
                message: 'Expired',
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                error: 'conflict',
                message: 'Consumed',
            });

        const expiredReq = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            body: { attemptId: 'attempt-1', code: '123456' },
        });
        const consumedReq = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            body: { attemptId: 'attempt-1', code: '123456' },
        });

        const expiredRes = await runWhatsAppMobileVerifyHttp(expiredReq);
        const consumedRes = await runWhatsAppMobileVerifyHttp(consumedReq);

        await expectErrorResponse(expiredRes, 410, 'validation');
        await expectErrorResponse(consumedRes, 409, 'conflict');
    });

    test('returns cached response for idempotent retry', async () => {
        (runWhatsAppMobileVerifyRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                status: 'approved',
                attemptId: 'attempt-1',
                exchangeCode: 'exchange-1',
                expiresAt: '2026-05-01T10:00:00.000Z',
                userId: 'user-1',
                linkage: 'existing',
            },
        });

        const headers = {
            'x-idempotency-key': 'verify-1',
            'x-client-timestamp': String(Date.now()),
        };
        const body = { attemptId: 'attempt-1', code: '123456' };

        const req1 = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            headers,
            body,
        });
        const req2 = createMockRequest('http://localhost/api/auth/whatsapp/mobile/verify', {
            method: 'POST',
            headers,
            body,
        });

        const res1 = await runWhatsAppMobileVerifyHttp(req1);
        const res2 = await runWhatsAppMobileVerifyHttp(req2);

        await expectSuccessResponse(res1, 200);
        await expectSuccessResponse(res2, 200);
        expect(runWhatsAppMobileVerifyRoute).toHaveBeenCalledTimes(1);
    });
});

