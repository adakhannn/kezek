import fs from 'node:fs';
import path from 'node:path';

import { POST } from '@/app/admin/api/analytics/track/route';
import { resolveOptionalRequestUser } from '@/lib/requestAuthContext';
import { getServiceClient } from '@/lib/supabaseService';
import { readTelemetryJson, telemetryMetadata } from '@/lib/telemetryIngest';

import { createMockRequest, expectErrorResponse, expectSuccessResponse } from './testHelpers';

jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/requestAuthContext', () => ({ resolveOptionalRequestUser: jest.fn() }));

const BIZ = '123e4567-e89b-42d3-a456-426614174000';
const post = (body: unknown) => POST(createMockRequest('http://localhost/admin/api/analytics/track', { method: 'POST', body }));

describe('/admin/api/analytics/track (API-09)', () => {
    const insert = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        insert.mockResolvedValue({ error: null });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(() => ({ insert })) });
        (resolveOptionalRequestUser as jest.Mock).mockResolvedValue(null);
    });

    test('the route is rate limited with the telemetry budget under its own template', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app/admin/api/analytics/track/route.ts'), 'utf8');
        expect(source).toMatch(/withRateLimit\(req, RateLimitConfigs\.telemetry,/);
        expect(source).toContain("'/admin/api/analytics/track'");
    });

    test('a signed-in caller (cookie or mobile bearer) is recorded as the client; the server owns booking_id', async () => {
        (resolveOptionalRequestUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

        await expectSuccessResponse(await post({ event_type: 'booking_flow_step', source: 'mobile', biz_id: BIZ, booking_id: null, session_id: 'm_1731900000000_x1y2', metadata: { platform: 'ios', step: 'slot' } }), 200);

        expect(insert).toHaveBeenCalledWith({
            event_type: 'booking_flow_step', biz_id: BIZ, branch_id: null, booking_id: null, client_id: 'user-1',
            source: 'mobile', session_id: 'm_1731900000000_x1y2', metadata: { platform: 'ios', step: 'slot' },
        });
    });

    test.each([
        ['a server-only booking event, even signed in', { event_type: 'booking_created', source: 'web', biz_id: BIZ }],
        ['a sign-in metric', { event_type: 'telegram_mobile_login_failed', source: 'mobile' }],
        ['a made-up source', { event_type: 'home_view', source: 'system' }],
        ['home_view tied to a business', { event_type: 'home_view', source: 'web', biz_id: BIZ }],
        ['a business event without a business', { event_type: 'business_page_view', source: 'web' }],
        ['a booking id from the client', { event_type: 'booking_flow_start', source: 'web', biz_id: BIZ, booking_id: BIZ }],
    ])('rejects %s', async (_label, body) => {
        (resolveOptionalRequestUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
        await expectErrorResponse(await post(body), 400, 'validation');
        expect(insert).not.toHaveBeenCalled();
    });

    test('a refused row is 400 and an outage 500, never with the database text', async () => {
        insert.mockResolvedValue({ error: { code: '23503', message: 'TENANT_REFERENCE_MISMATCH detail secret' } });
        const refused = await post({ event_type: 'business_page_view', source: 'web', biz_id: BIZ, branch_id: BIZ });
        expect(refused.status).toBe(400);
        expect(JSON.stringify(await refused.json())).not.toContain('secret');

        insert.mockResolvedValue({ error: { code: 'XX000', message: 'disk full on db-1' } });
        const outage = await post({ event_type: 'home_view', source: 'web' });
        expect(outage.status).toBe(500);
        expect(JSON.stringify(await outage.json())).not.toContain('db-1');
    });
});

describe('telemetry ingest helpers', () => {
    test('a body without Content-Length is still bounded while streaming', async () => {
        const big = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`{"x":"${'a'.repeat(5000)}"}`)); controller.close(); } });
        const req = new Request('http://localhost/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big, duplex: 'half' } as RequestInit);
        await expect(readTelemetryJson(req)).resolves.toEqual({ ok: false, status: 413 });
    });

    test('metadata is flat, short and small', () => {
        expect(telemetryMetadata.safeParse({ locale: 'ru', step: 1, ok: true, none: null }).success).toBe(true);
        expect(telemetryMetadata.safeParse({ nested: { a: 1 } }).success).toBe(false);
        expect(telemetryMetadata.safeParse({ long: 'x'.repeat(201) }).success).toBe(false);
        expect(telemetryMetadata.safeParse(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))).success).toBe(false);
    });
});
