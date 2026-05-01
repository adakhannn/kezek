import { runWhatsAppMobileStartHttp } from '@/lib/whatsAppMobileStartHttpService';
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

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn((v: string) => v),
}));

jest.mock('@/lib/rateLimit', () => ({
    getRateLimitIdentifier: jest.fn(() => 'ip:test'),
}));

jest.mock('@/lib/whatsAppMobileStartRouteService', () => ({
    runWhatsAppMobileStartRoute: jest.fn(),
}));

import { runWhatsAppMobileStartRoute } from '@/lib/whatsAppMobileStartRouteService';

describe('runWhatsAppMobileStartHttp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetWhatsAppMobileIdempotencyForTests();
        __resetWhatsAppMobileAbuseProtectionForTests();
    });

    test('returns start payload on success', async () => {
        (runWhatsAppMobileStartRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                attemptId: 'attempt-1',
                maskedDestination: '+********4029',
                expiresAt: '2026-05-01T10:00:00.000Z',
            },
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/mobile/start', {
            method: 'POST',
            body: { phone: '+996500574029' },
        });

        const res = await runWhatsAppMobileStartHttp(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('attemptId', 'attempt-1');
        expect(data).toHaveProperty('maskedDestination', '+********4029');
        expect(runWhatsAppMobileStartRoute).toHaveBeenCalledTimes(1);
    });

    test('returns 400 for invalid json', async () => {
        const req = createMockRequest('http://localhost/api/auth/whatsapp/mobile/start', {
            method: 'POST',
            body: '{',
        });

        const res = await runWhatsAppMobileStartHttp(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns cached response for idempotent retry', async () => {
        (runWhatsAppMobileStartRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: {
                attemptId: 'attempt-1',
                maskedDestination: '+********4029',
                expiresAt: '2026-05-01T10:00:00.000Z',
            },
        });

        const headers = {
            'x-idempotency-key': 'start-1',
            'x-client-timestamp': String(Date.now()),
        };

        const req1 = createMockRequest('http://localhost/api/auth/whatsapp/mobile/start', {
            method: 'POST',
            headers,
            body: { phone: '+996500574029' },
        });
        const req2 = createMockRequest('http://localhost/api/auth/whatsapp/mobile/start', {
            method: 'POST',
            headers,
            body: { phone: '+996500574029' },
        });

        const res1 = await runWhatsAppMobileStartHttp(req1);
        const res2 = await runWhatsAppMobileStartHttp(req2);

        await expectSuccessResponse(res1, 200);
        await expectSuccessResponse(res2, 200);
        expect(runWhatsAppMobileStartRoute).toHaveBeenCalledTimes(1);
    });
});

