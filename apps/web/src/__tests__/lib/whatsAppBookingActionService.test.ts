jest.mock('@core-domain/booking', () => ({
    cancelBookingUseCase: jest.fn(),
    confirmBookingUseCase: jest.fn(),
}));

jest.mock('@/lib/bookingCommandsSupabase', () => ({
    createSupabaseBookingCommands: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

import {
    cancelBookingUseCase,
    confirmBookingUseCase,
} from '@core-domain/booking';

import { createSupabaseBookingCommands } from '@/lib/bookingCommandsSupabase';
import { logError } from '@/lib/log';
import {
    runWhatsAppCancelBooking,
    runWhatsAppConfirmBooking,
} from '@/lib/whatsAppBookingActionService';

describe('whatsAppBookingActionService', () => {
    const supabase = { rpc: jest.fn() } as any;
    const commands = { cancelBooking: jest.fn(), confirmBooking: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseBookingCommands as jest.Mock).mockReturnValue(commands);
    });

    it('delegates cancel action to core-domain use case', async () => {
        (cancelBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await runWhatsAppCancelBooking({ supabase }, 'booking-1');

        expect(createSupabaseBookingCommands).toHaveBeenCalledWith(supabase);
        expect(cancelBookingUseCase).toHaveBeenCalledWith(
            { commands },
            'booking-1',
        );
    });

    it('delegates confirm action to core-domain use case', async () => {
        (confirmBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await runWhatsAppConfirmBooking({ supabase }, 'booking-2');

        expect(createSupabaseBookingCommands).toHaveBeenCalledWith(supabase);
        expect(confirmBookingUseCase).toHaveBeenCalledWith(
            { commands },
            'booking-2',
        );
    });

    it('logs and rethrows cancel use case failures', async () => {
        const error = new Error('cancel failed');
        (cancelBookingUseCase as jest.Mock).mockRejectedValue(error);

        await expect(runWhatsAppCancelBooking({ supabase }, 'booking-cancel-error')).rejects.toThrow(
            'cancel failed',
        );

        expect(logError).toHaveBeenCalledWith(
            'WhatsAppBookingActionService',
            'Cancel use case execution failed',
            expect.objectContaining({
                error,
                bookingId: 'booking-cancel-error',
            }),
        );
    });

    it('logs and rethrows confirm use case failures', async () => {
        const error = new Error('confirm failed');
        (confirmBookingUseCase as jest.Mock).mockRejectedValue(error);

        await expect(
            runWhatsAppConfirmBooking({ supabase }, 'booking-confirm-error'),
        ).rejects.toThrow('confirm failed');

        expect(logError).toHaveBeenCalledWith(
            'WhatsAppBookingActionService',
            'Confirm use case execution failed',
            expect.objectContaining({
                error,
                bookingId: 'booking-confirm-error',
            }),
        );
    });
});
