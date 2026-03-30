import {
    cancelBookingUseCase,
    type BookingCommandsPort,
    type BookingNotificationPort,
} from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError } from '@/lib/log';

function createServerCancelCommands(
    supabase: SupabaseClient,
    options: {
        clientId?: string;
    } = {},
): BookingCommandsPort {
    const { clientId } = options;

    return {
        async holdSlot() {
            throw new Error('holdSlot is not supported in cancel flow');
        },

        async confirmBooking() {
            throw new Error('confirmBooking is not supported in cancel flow');
        },

        async cancelBooking(bookingId: string) {
            logDebug('ServerCancelBookingService', 'Calling cancel_booking RPC', {
                bookingId,
            });

            const { error } = await supabase.rpc('cancel_booking', {
                p_booking_id: bookingId,
            });

            if (!error) {
                return;
            }

            const errorMessage = error.message.toLowerCase();
            if (
                errorMessage.includes('not assigned to branch') ||
                errorMessage.includes('staff')
            ) {
                let updateQuery = supabase
                    .from('bookings')
                    .update({ status: 'cancelled' })
                    .eq('id', bookingId);

                if (clientId) {
                    updateQuery = updateQuery.eq('client_id', clientId);
                }

                const { error: updateError } = await updateQuery;

                if (updateError) {
                    logError(
                        'ServerCancelBookingService',
                        'Fallback booking status update failed',
                        {
                            bookingId,
                            error: updateError,
                        },
                    );
                    throw updateError;
                }

                return;
            }

            logError('ServerCancelBookingService', 'cancel_booking RPC failed', {
                bookingId,
                error,
            });
            throw error;
        },
    };
}

export async function runServerCancelBooking(
    deps: {
        supabase: SupabaseClient;
        notify?: (payload: {
            bookingId: string;
            type: 'hold' | 'confirm' | 'cancel';
        }) => Promise<void>;
        clientId?: string;
    },
    bookingId: string,
): Promise<void> {
    const notifications: BookingNotificationPort | undefined = deps.notify
        ? {
              async send(id, type) {
                  await deps.notify?.({ bookingId: id, type });
              },
          }
        : undefined;

    await cancelBookingUseCase(
        {
            commands: createServerCancelCommands(deps.supabase, {
                clientId: deps.clientId,
            }),
            notifications,
        },
        bookingId,
    );
}
