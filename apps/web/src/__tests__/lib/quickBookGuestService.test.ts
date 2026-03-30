import { runQuickBookGuest, type QuickBookGuestInput } from '@/lib/quickBookGuestService';

describe('quickBookGuestService', () => {
    const input: QuickBookGuestInput = {
        biz_id: '00000000-0000-0000-0000-000000000001',
        branch_id: '00000000-0000-0000-0000-000000000002',
        service_id: '00000000-0000-0000-0000-000000000003',
        staff_id: '00000000-0000-0000-0000-000000000004',
        start_at: '2026-03-21T10:00:00.000Z',
        client_name: 'Test User',
        client_phone: '+996555123456',
        client_email: 'test@example.com',
    };

    test('returns success payload after hold, confirm and notify', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({
                data: 'booking-id-123',
                error: null,
            })
            .mockResolvedValueOnce({
                data: { ok: true },
                error: null,
            });
        const notifyGuestBooking = jest.fn().mockResolvedValue(undefined);

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc,
                },
                notifyGuestBooking,
            },
            input,
        );

        expect(result).toEqual({
            bookingId: 'booking-id-123',
            confirmed: true,
        });
        expect(rpc).toHaveBeenNthCalledWith(1, 'hold_slot_guest', {
            p_biz_id: input.biz_id,
            p_branch_id: input.branch_id,
            p_service_id: input.service_id,
            p_staff_id: input.staff_id,
            p_start: input.start_at,
            p_client_name: input.client_name,
            p_client_phone: input.client_phone,
            p_client_email: input.client_email,
        });
        expect(rpc).toHaveBeenNthCalledWith(2, 'confirm_booking', {
            p_booking_id: 'booking-id-123',
        });
        expect(notifyGuestBooking).toHaveBeenCalledWith({
            bookingId: 'booking-id-123',
            type: 'confirm',
        });
    });

    test('returns not_found response when active branch is missing', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc: jest.fn(),
                },
                notifyGuestBooking: jest.fn(),
            },
            input,
        );

        expect('status' in result && result.status).toBe(400);
    });

    test('uses complex guest hold rpc when multiple services are provided', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({
                data: 'complex-booking-id-123',
                error: null,
            })
            .mockResolvedValueOnce({
                data: { ok: true },
                error: null,
            });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc,
                },
                notifyGuestBooking: jest.fn().mockResolvedValue(undefined),
            },
            {
                ...input,
                services: [
                    { service_id: 'service-1', duration_min: 30 },
                    { service_id: 'service-2', duration_min: 45, order_index: 3 },
                ],
            },
        );

        expect(result).toEqual({
            bookingId: 'complex-booking-id-123',
            confirmed: true,
        });
        expect(rpc).toHaveBeenNthCalledWith(1, 'hold_complex_slot_guest', {
            p_biz_id: input.biz_id,
            p_branch_id: input.branch_id,
            p_staff_id: input.staff_id,
            p_start: input.start_at,
            p_services: [
                { service_id: 'service-1', duration_min: 30 },
                { service_id: 'service-2', duration_min: 45, order_index: 3 },
            ],
            p_client_name: input.client_name,
            p_client_phone: input.client_phone,
            p_client_email: input.client_email,
        });
    });

    test('returns validation response when hold rpc fails', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'slot unavailable' },
                    }),
                },
                notifyGuestBooking: jest.fn().mockResolvedValue(undefined),
            },
            input,
        );

        expect('status' in result && result.status).toBe(400);
        await expect((result as Response).json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'slot unavailable',
            details: { code: 'rpc' },
        });
    });

    test('returns validation response when rpc returns unexpected payload shape', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc: jest.fn().mockResolvedValue({
                        data: { unexpected: true },
                        error: null,
                    }),
                },
                notifyGuestBooking: jest.fn().mockResolvedValue(undefined),
            },
            input,
        );

        expect('status' in result && result.status).toBe(400);
        await expect((result as Response).json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'Unexpected RPC result format',
            details: { code: 'rpc_shape' },
        });
    });

    test('still returns success when confirm rpc fails after hold', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });
        const notifyGuestBooking = jest.fn().mockResolvedValue(undefined);
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({
                data: 'booking-confirm-error',
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'confirm failed', code: '500' },
            });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc,
                },
                notifyGuestBooking,
            },
            input,
        );

        expect(result).toEqual({
            bookingId: 'booking-confirm-error',
            confirmed: true,
        });
        expect(notifyGuestBooking).toHaveBeenCalledWith({
            bookingId: 'booking-confirm-error',
            type: 'confirm',
        });
    });

    test('swallows notify errors and still returns success payload', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: input.branch_id },
            error: null,
        });
        const eq = jest.fn().mockReturnThis();
        const select = jest.fn().mockReturnValue({
            eq,
            maybeSingle,
        });

        const result = await runQuickBookGuest(
            {
                supabase: {
                    from: jest.fn(() => ({ select })),
                    rpc: jest
                        .fn()
                        .mockResolvedValueOnce({
                            data: 'booking-notify-error',
                            error: null,
                        })
                        .mockResolvedValueOnce({
                            data: { ok: true },
                            error: null,
                        }),
                },
                notifyGuestBooking: jest.fn().mockRejectedValue(new Error('notify failed')),
            },
            input,
        );

        expect(result).toEqual({
            bookingId: 'booking-notify-error',
            confirmed: true,
        });
    });
});
