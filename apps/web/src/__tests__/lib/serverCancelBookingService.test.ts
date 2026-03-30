jest.mock('@core-domain/booking', () => ({
    cancelBookingUseCase: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
}));

import { cancelBookingUseCase } from '@core-domain/booking';

import { logError } from '@/lib/log';
import { runServerCancelBooking } from '@/lib/serverCancelBookingService';

describe('serverCancelBookingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('passes commands and notifications into core-domain use case', async () => {
        const notify = jest.fn().mockResolvedValue(undefined);
        (cancelBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await runServerCancelBooking(
            {
                supabase: { rpc: jest.fn(), from: jest.fn() } as any,
                notify,
            },
            'booking-1',
        );

        expect(cancelBookingUseCase).toHaveBeenCalledWith(
            {
                commands: expect.objectContaining({
                    holdSlot: expect.any(Function),
                    confirmBooking: expect.any(Function),
                    cancelBooking: expect.any(Function),
                }),
                notifications: expect.objectContaining({
                    send: expect.any(Function),
                }),
            },
            'booking-1',
        );

        const notifications = (cancelBookingUseCase as jest.Mock).mock.calls[0][0].notifications;
        await notifications.send('booking-1', 'cancel');
        expect(notify).toHaveBeenCalledWith({ bookingId: 'booking-1', type: 'cancel' });
    });

    it('omits notifications port when notify callback is absent', async () => {
        (cancelBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await runServerCancelBooking(
            {
                supabase: { rpc: jest.fn(), from: jest.fn() } as any,
            },
            'booking-no-notify',
        );

        expect((cancelBookingUseCase as jest.Mock).mock.calls[0][0].notifications).toBeUndefined();
    });

    it('rejects unsupported hold and confirm commands inside cancel flow', async () => {
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await expect(commands.holdSlot()).rejects.toThrow(
                'holdSlot is not supported in cancel flow',
            );
            await expect(commands.confirmBooking()).rejects.toThrow(
                'confirmBooking is not supported in cancel flow',
            );
        });

        await expect(
            runServerCancelBooking(
                {
                    supabase: { rpc: jest.fn(), from: jest.fn() } as any,
                },
                'booking-unsupported',
            ),
        ).resolves.toBeUndefined();
    });

    it('cancels booking through rpc without fallback when rpc succeeds', async () => {
        const rpc = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn();
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.cancelBooking('booking-rpc');
        });

        await runServerCancelBooking(
            {
                supabase: { rpc, from } as any,
            },
            'booking-rpc',
        );

        expect(rpc).toHaveBeenCalledWith('cancel_booking', { p_booking_id: 'booking-rpc' });
        expect(from).not.toHaveBeenCalled();
    });

    it('falls back to direct status update for staff assignment errors', async () => {
        const rpc = jest.fn().mockResolvedValue({
            error: { message: 'Staff is not assigned to branch' },
        });
        const eqClient = jest.fn().mockResolvedValue({ error: null });
        const eqId = jest.fn().mockReturnValue({ eq: eqClient });
        const update = jest.fn().mockReturnValue({ eq: eqId });
        const from = jest.fn().mockReturnValue({ update });
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.cancelBooking('booking-2');
        });

        await runServerCancelBooking(
            {
                supabase: { rpc, from } as any,
                clientId: 'client-1',
            },
            'booking-2',
        );

        expect(from).toHaveBeenCalledWith('bookings');
        expect(update).toHaveBeenCalledWith({ status: 'cancelled' });
        expect(eqId).toHaveBeenCalledWith('id', 'booking-2');
        expect(eqClient).toHaveBeenCalledWith('client_id', 'client-1');
    });

    it('logs and throws when fallback update fails', async () => {
        const updateError = new Error('update failed');
        const rpc = jest.fn().mockResolvedValue({
            error: { message: 'Booking not assigned to branch staff anymore' },
        });
        const eq = jest.fn().mockResolvedValue({ error: updateError });
        const update = jest.fn().mockReturnValue({ eq });
        const from = jest.fn().mockReturnValue({ update });
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.cancelBooking('booking-fallback-error');
        });

        await expect(
            runServerCancelBooking(
                {
                    supabase: { rpc, from } as any,
                },
                'booking-fallback-error',
            ),
        ).rejects.toThrow('update failed');

        expect(logError).toHaveBeenCalledWith(
            'ServerCancelBookingService',
            'Fallback booking status update failed',
            expect.objectContaining({
                bookingId: 'booking-fallback-error',
                error: updateError,
            }),
        );
    });

    it('logs and rethrows non-fallback rpc errors', async () => {
        const rpcError = { message: 'permission denied' };
        const rpc = jest.fn().mockResolvedValue({ error: rpcError });
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.cancelBooking('booking-rpc-error');
        });

        await expect(
            runServerCancelBooking(
                {
                    supabase: { rpc, from: jest.fn() } as any,
                },
                'booking-rpc-error',
            ),
        ).rejects.toEqual(rpcError);

        expect(logError).toHaveBeenCalledWith(
            'ServerCancelBookingService',
            'cancel_booking RPC failed',
            expect.objectContaining({
                bookingId: 'booking-rpc-error',
                error: rpcError,
            }),
        );
    });
});
