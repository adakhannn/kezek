import { POST } from '@/app/api/funnel-events/route';
import { getServiceClient } from '@/lib/supabaseService';

import { createMockRequest, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from './testHelpers';

setupApiTestMocks();

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/funnel-events', () => {
    const insert = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        insert.mockReset();

        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest.fn().mockReturnValue({
                insert,
            }),
        });
    });

    test('returns validation error for invalid payload', async () => {
        const req = createMockRequest('http://localhost/api/funnel-events', {
            method: 'POST',
            body: {
                event_type: 'invalid',
            },
        });

        const res = await POST(req);
        const data = await expectErrorResponse(res, 400, 'validation');

        expect(data.message).toContain('Validation failed');
    });

    test('saves funnel event and returns ok', async () => {
        insert.mockResolvedValue({ error: null });

        const req = createMockRequest('http://localhost/api/funnel-events', {
            method: 'POST',
            body: {
                event_type: 'booking_success',
                source: 'public',
                biz_id: '123e4567-e89b-42d3-a456-426614174000',
                branch_id: '123e4567-e89b-42d3-a456-426614174001',
                service_id: '123e4567-e89b-42d3-a456-426614174002',
                service_ids: ['123e4567-e89b-42d3-a456-426614174002'],
                services_count: 1,
                staff_id: '123e4567-e89b-42d3-a456-426614174003',
                slot_start_at: '2026-03-27T10:00:00.000Z',
                booking_id: '123e4567-e89b-42d3-a456-426614174004',
                session_id: 'session-1',
                user_agent: 'jest',
                referrer: 'https://example.com',
                timestamp: '2026-03-27T10:00:00.000Z',
                metadata: { step: 'success' },
            },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
        expect(insert).toHaveBeenCalledTimes(1);
    });

    test('returns internal error when persistence fails', async () => {
        insert.mockResolvedValue({ error: { message: 'db failed' } });

        const req = createMockRequest('http://localhost/api/funnel-events', {
            method: 'POST',
            body: {
                event_type: 'booking_abandon',
                source: 'quickdesk',
                biz_id: '123e4567-e89b-42d3-a456-426614174000',
                session_id: 'session-2',
                timestamp: '2026-03-27T10:00:00.000Z',
            },
        });

        const res = await POST(req);
        const data = await expectErrorResponse(res, 500, 'internal');

        expect(data.message).toBe('db failed');
    });
});
