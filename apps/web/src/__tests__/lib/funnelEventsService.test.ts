import { saveFunnelEvent, type FunnelEventInput, type FunnelEventsAdminLike } from '@/lib/funnelEventsService';

describe('funnelEventsService', () => {
    function createAdmin(error: { message: string } | null = null): jest.Mocked<FunnelEventsAdminLike> {
        return {
            from: jest.fn().mockReturnValue({
                insert: jest.fn().mockResolvedValue({ error }),
            }),
        } as unknown as jest.Mocked<FunnelEventsAdminLike>;
    }

    function createEvent(overrides: Partial<FunnelEventInput> = {}): FunnelEventInput {
        return {
            event_type: 'slot_select',
            source: 'public',
            biz_id: '123e4567-e89b-42d3-a456-426614174000',
            branch_id: '123e4567-e89b-42d3-a456-426614174001',
            service_id: '123e4567-e89b-42d3-a456-426614174002',
            service_ids: ['123e4567-e89b-42d3-a456-426614174002'],
            services_count: 1,
            staff_id: '123e4567-e89b-42d3-a456-426614174003',
            slot_start_at: '2026-03-27T10:00:00.000Z',
            booking_id: null,
            session_id: 'session-1',
            user_agent: 'jest',
            referrer: 'https://example.com',
            timestamp: '2026-03-27T10:00:00.000Z',
            metadata: { sourceStep: 'booking' },
            ...overrides,
        };
    }

    test('saves normalized funnel event payload', async () => {
        const admin = createAdmin();
        const event = createEvent({
            branch_id: null,
            service_id: null,
            service_ids: undefined,
            services_count: undefined,
            user_agent: null,
            referrer: undefined,
            metadata: null,
        });

        const result = await saveFunnelEvent(admin, event);

        expect(result).toEqual({ ok: true });
        expect(admin.from).toHaveBeenCalledWith('funnel_events');
        const insert = admin.from.mock.results[0]?.value.insert as jest.Mock;
        expect(insert).toHaveBeenCalledWith({
            event_type: 'slot_select',
            source: 'public',
            biz_id: '123e4567-e89b-42d3-a456-426614174000',
            branch_id: null,
            service_id: null,
            staff_id: '123e4567-e89b-42d3-a456-426614174003',
            slot_start_at: '2026-03-27T10:00:00.000Z',
            booking_id: null,
            session_id: 'session-1',
            user_agent: null,
            referrer: null,
            created_at: '2026-03-27T10:00:00.000Z',
            metadata: null,
        });
    });

    test('stores service array details in metadata instead of non-schema columns', async () => {
        const admin = createAdmin();

        const result = await saveFunnelEvent(admin, createEvent());

        expect(result).toEqual({ ok: true });
        const insert = admin.from.mock.results[0]?.value.insert as jest.Mock;
        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                service_id: '123e4567-e89b-42d3-a456-426614174002',
                metadata: {
                    sourceStep: 'booking',
                    service_ids: ['123e4567-e89b-42d3-a456-426614174002'],
                    services_count: 1,
                },
            }),
        );
    });

    test('returns internal error when insert fails', async () => {
        const admin = createAdmin({ message: 'insert failed' });

        const result = await saveFunnelEvent(admin, createEvent());

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'insert failed',
            status: 500,
        });
    });
});
