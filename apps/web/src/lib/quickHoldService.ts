import {
    createBookingUseCase,
    type CreateBookingParams,
    type CreateBookingResult,
    type BookingNotificationPort,
} from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseBookingCommands } from '@/lib/bookingCommandsSupabase';
import { BookingSlotConflictError } from '@/lib/bookingSlotConflict';
import { logDebug, logError, logWarn } from '@/lib/log';
import { SupabaseBranchRepository } from '@/lib/repositories';

export async function runQuickHold(
    deps: {
        supabase: SupabaseClient;
        userId: string;
        notify: (payload: {
            bookingId: string;
            type: 'hold' | 'confirm' | 'cancel';
        }) => Promise<void>;
    },
    input: CreateBookingParams,
): Promise<CreateBookingResult> {
    const { supabase, userId, notify } = deps;

    const branchRepository = new SupabaseBranchRepository(supabase);
    const commands = createSupabaseBookingCommands(supabase, { userId });

    const notifications: BookingNotificationPort = {
        async send(bookingId, type) {
            await notify({ bookingId, type });
            logDebug('QuickHoldService', 'Notification dispatch attempt completed', {
                bookingId,
                type,
            });
        },
    };

    try {
        return await createBookingUseCase(
            {
                branchRepository,
                commands,
                notifications,
            },
            input,
        );
    } catch (error) {
        const logger = error instanceof BookingSlotConflictError ? logWarn : logError;
        logger('QuickHoldService', 'Use case execution failed', error);
        throw error;
    }
}
