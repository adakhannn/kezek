import {
    createBookingUseCase,
    type CreateBookingParams,
    type CreateBookingResult,
    type BookingNotificationPort,
} from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseBookingCommands } from '@/lib/bookingCommandsSupabase';
import { logDebug, logError } from '@/lib/log';
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
            logDebug('QuickHoldService', 'Notification sent successfully', {
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
        logError('QuickHoldService', 'Use case execution failed', error);
        throw error;
    }
}
