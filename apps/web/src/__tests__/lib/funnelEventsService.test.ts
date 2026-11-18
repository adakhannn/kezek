import { saveFunnelEvent, type FunnelEventInput, type FunnelEventsAdminLike } from '@/lib/funnelEventsService';

describe('funnelEventsService', () => {
    function createAdmin(error: { message: string; code?: string } | null = null) {
        const insert = jest.fn().mockResolvedValue({ error });
        const admin = { from: jest.fn().mockReturnValue({ insert }), rpc: jest.fn() } as unknown as FunnelEventsAdminLike;
        return { admin, insert };
    }

    const event = (overrides: Partial<FunnelEventInput> = {}): FunnelEventInput => ({
        event_type: 'slot_select',
        source: 'public',
        biz_id: '123e4567-e89b-42d3-a456-426614174000',
        branch_id: '123e4567-e89b-42d3-a456-426614174001',
        service_id: '123e4567-e89b-42d3-a456-426614174002',
        service_ids: ['123e4567-e89b-42d3-a456-426614174002'],
        services_count: 1,
        staff_id: null,
        slot_start_at: '2026-11-18T10:00:00.000Z',
        booking_id: null,
        session_id: 'session_1731900000000_abc123',
        user_agent: 'jest',
        referrer: null,
        timestamp: '2999-01-01T00:00:00.000Z',
        metadata: { step: 'slot' },
        ...overrides,
    });

    test('saves the normalized event; the database sets the time (API-09)', async () => {
        const { admin, insert } = createAdmin();

        await expect(saveFunnelEvent(admin, event())).resolves.toEqual({ ok: true });

        const row = insert.mock.calls[0][0];
        expect(row).not.toHaveProperty('created_at');
        expect(row).toMatchObject({
            event_type: 'slot_select',
            branch_id: '123e4567-e89b-42d3-a456-426614174001',
            metadata: { step: 'slot', service_ids: ['123e4567-e89b-42d3-a456-426614174002'], services_count: 1 },
        });
    });

    test('a failed insert returns the error for the HTTP layer to map', async () => {
        const { admin } = createAdmin({ code: '23503', message: 'TENANT_REFERENCE_MISMATCH' });

        await expect(saveFunnelEvent(admin, event())).resolves.toEqual({ ok: false, error: { code: '23503', message: 'TENANT_REFERENCE_MISMATCH' } });
    });
});
