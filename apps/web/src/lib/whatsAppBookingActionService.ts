import {
    cancelBookingUseCase,
    confirmBookingUseCase,
} from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseBookingCommands } from '@/lib/bookingCommandsSupabase';
import { logError } from '@/lib/log';

export async function runWhatsAppCancelBooking(
    deps: {
        supabase: SupabaseClient;
    },
    bookingId: string,
): Promise<void> {
    try {
        await cancelBookingUseCase(
            {
                commands: createSupabaseBookingCommands(deps.supabase),
            },
            bookingId,
        );
    } catch (error) {
        logError('WhatsAppBookingActionService', 'Cancel use case execution failed', {
            error,
            bookingId,
        });
        throw error;
    }
}

export async function runWhatsAppConfirmBooking(
    deps: {
        supabase: SupabaseClient;
    },
    bookingId: string,
): Promise<void> {
    try {
        await confirmBookingUseCase(
            {
                commands: createSupabaseBookingCommands(deps.supabase),
            },
            bookingId,
        );
    } catch (error) {
        logError('WhatsAppBookingActionService', 'Confirm use case execution failed', {
            error,
            bookingId,
        });
        throw error;
    }
}
