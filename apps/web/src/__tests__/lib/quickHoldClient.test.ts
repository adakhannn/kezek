import {
    createQuickHoldBooking,
    QuickHoldClientError,
} from '@/lib/quickHoldClient';

describe('quickHoldClient', () => {
    it('returns booking id from standardized success response', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                data: {
                    booking_id: 'booking-123',
                    confirmed: true,
                },
            }),
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).resolves.toEqual({ bookingId: 'booking-123' });
    });

    it('returns booking id from direct top-level payload', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                booking_id: 'booking-top-level',
            }),
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).resolves.toEqual({ bookingId: 'booking-top-level' });
    });

    it('throws structured error for failed response', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({
                ok: false,
                error: 'validation',
                message: 'Branch not found or inactive',
                details: { kind: 'BRANCH_NOT_FOUND_OR_INACTIVE' },
            }),
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).rejects.toMatchObject<QuickHoldClientError>({
            name: 'QuickHoldClientError',
            message: 'Branch not found or inactive',
            status: 400,
            details: { kind: 'BRANCH_NOT_FOUND_OR_INACTIVE' },
        });
    });

    it('falls back to error code when failed response has no message', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                ok: false,
                error: 'conflict',
            }),
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).rejects.toMatchObject<QuickHoldClientError>({
            message: 'conflict',
            status: 409,
        });
    });

    it('falls back to default message when response body json is invalid', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error('invalid json');
            },
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).rejects.toMatchObject<QuickHoldClientError>({
            message: 'Failed to create booking',
            status: 500,
        });
    });

    it('throws if success response has no booking id', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                data: {
                    confirmed: true,
                },
            }),
        });

        await expect(
            createQuickHoldBooking(
                {
                    biz_id: '11111111-1111-4111-8111-111111111111',
                    branch_id: '22222222-2222-4222-8222-222222222222',
                    service_id: '33333333-3333-4333-8333-333333333333',
                    staff_id: '44444444-4444-4444-8444-444444444444',
                    start_at: '2026-03-21T10:00:00Z',
                },
                { fetchImpl: fetchImpl as unknown as typeof fetch },
            ),
        ).rejects.toThrow('Booking created without booking_id');
    });
});
