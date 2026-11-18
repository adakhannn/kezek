import fs from 'node:fs';
import path from 'node:path';

import { POST } from '@/app/api/funnel-events/route';
import { resolveOptionalRequestUser } from '@/lib/requestAuthContext';
import { getServiceClient } from '@/lib/supabaseService';

import { createMockRequest, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from './testHelpers';

setupApiTestMocks();

jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/requestAuthContext', () => ({ resolveOptionalRequestUser: jest.fn() }));
jest.mock('@/lib/env', () => ({ ...jest.requireActual('@/lib/env'), isSupabaseServiceRoleConfigured: () => true }));

const BIZ = '123e4567-e89b-42d3-a456-426614174000';
const event = (overrides: Record<string, unknown> = {}) => ({
    event_type: 'branch_select',
    source: 'public',
    biz_id: BIZ,
    branch_id: '123e4567-e89b-42d3-a456-426614174001',
    session_id: 'session_1731900000000_abc123',
    timestamp: '2026-11-18T10:00:00.000Z',
    ...overrides,
});
const post = (body: unknown, headers?: Record<string, string>) =>
    POST(createMockRequest('http://localhost/api/funnel-events', { method: 'POST', body, headers }));

describe('/api/funnel-events (API-09)', () => {
    const insert = jest.fn();
    const rpc = jest.fn();
    const staffLimit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        insert.mockResolvedValue({ error: null });
        rpc.mockResolvedValue({ data: false, error: null });
        staffLimit.mockResolvedValue({ data: [], error: null });
        const staffChain = { eq: () => staffChain, limit: staffLimit };
        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest.fn((table: string) => (table === 'staff' ? { select: () => staffChain } : { insert })),
            rpc,
        });
        (resolveOptionalRequestUser as jest.Mock).mockResolvedValue(null);
    });

    test('the route is rate limited with the telemetry budget under its own template', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app/api/funnel-events/route.ts'), 'utf8');
        expect(source).toMatch(/withRateLimit\(req, RateLimitConfigs\.telemetry,/);
        expect(source).toContain("'/api/funnel-events'");
    });

    test('a public event is saved with the database time, not the client timestamp', async () => {
        const res = await post(event());
        await expectSuccessResponse(res, 200);
        expect(insert).toHaveBeenCalledWith(expect.not.objectContaining({ created_at: expect.anything() }));
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'branch_select', session_id: 'session_1731900000000_abc123' }));
    });

    test.each([
        ['an unknown event type', { event_type: 'invalid' }],
        ['booking_success without the booking', { event_type: 'booking_success', booking_id: null }],
        ['nested metadata', { metadata: { deep: { secret: 1 } } }],
        ['too many services', { service_ids: Array.from({ length: 21 }, () => BIZ) }],
        ['a session id with spaces', { session_id: 'not a session' }],
        ['a slot that is not a time', { slot_start_at: 'tomorrow' }],
    ])('rejects %s', async (_label, overrides) => {
        await expectErrorResponse(await post(event(overrides)), 400, 'validation');
        expect(insert).not.toHaveBeenCalled();
    });

    test('only JSON is accepted and the body is bounded', async () => {
        const plain = new Request('http://localhost/api/funnel-events', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(event()) });
        await expectErrorResponse(await POST(plain), 415, 'validation');
        await expectErrorResponse(await post(event({ referrer: 'x'.repeat(5000) })), 413, 'validation');
        expect(insert).not.toHaveBeenCalled();
    });

    test('a database failure is reported without the database text', async () => {
        insert.mockResolvedValue({ error: { code: 'XX000', message: 'relation funnel_events is broken at 10.0.0.5' } });
        const res = await post(event());
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('10.0.0.5');
    });

    test('quickdesk events need a member of that business', async () => {
        await expectErrorResponse(await post(event({ source: 'quickdesk' })), 403, 'forbidden');

        (resolveOptionalRequestUser as jest.Mock).mockResolvedValue({ id: 'stranger' });
        await expectErrorResponse(await post(event({ source: 'quickdesk' })), 403, 'forbidden');

        rpc.mockResolvedValue({ data: true, error: null });
        await expectSuccessResponse(await post(event({ source: 'quickdesk' })), 200);
        expect(rpc).toHaveBeenCalledWith('finance_can_manage_business', { p_actor_id: 'stranger', p_biz_id: BIZ });

        rpc.mockResolvedValue({ data: false, error: null });
        staffLimit.mockResolvedValue({ data: [{ id: 'staff-1' }], error: null });
        await expectSuccessResponse(await post(event({ source: 'quickdesk' })), 200);

        rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
        expect((await post(event({ source: 'quickdesk' }))).status).toBe(503);
        expect(insert).toHaveBeenCalledTimes(2);
    });
});
