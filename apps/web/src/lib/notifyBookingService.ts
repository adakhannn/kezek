import { sendBookingNotificationsUseCase } from '@core-domain/booking';
import type { BookingNotificationPort } from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getEmailFrom, getResendApiKey } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import type { BookingRow, NotificationResult } from '@/lib/notifications/types';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

type NotifyBookingInput = {
    type: 'hold' | 'confirm' | 'cancel';
    booking_id: string;
};

type NotifyBookingFailure = {
    ok: false;
    status: 401 | 403 | 404 | 500;
    error: 'auth' | 'forbidden' | 'not_found' | 'internal';
    message: string;
};

type NotifyBookingSuccess = {
    ok: true;
    data: {
        sent: number;
        whatsappSent: number;
        telegramSent: number;
    };
};

type NotifyBookingResult = NotifyBookingFailure | NotifyBookingSuccess;

export async function runNotifyBooking({
    type,
    booking_id,
}: NotifyBookingInput, requestClient?: SupabaseClient): Promise<NotifyBookingResult> {
    logDebug('Notify', 'Received notification request', { type, booking_id });

    let apiKey: string;
    try {
        apiKey = getResendApiKey();
    } catch (error) {
        logError('Notify', 'RESEND_API_KEY is not set', error);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'RESEND_API_KEY is not set',
        };
    }

    const from = getEmailFrom();
    const { supabase: cookieClient, admin } = await createSupabaseClients();
    // Server callers reuse the authenticated request client, including bearer auth.
    // Authentication and booking ownership checks below still apply to every call.
    const supabase = requestClient ?? cookieClient;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        };
    }

    const bookingDataService = new BookingDataService(admin);
    const booking = await bookingDataService.getBookingById(booking_id);

    if (!booking) {
        logError('Notify', 'Booking not found', { booking_id });
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Booking not found',
        };
    }

    const isClient = booking.client_id === user.id;
    if (!isClient) {
        try {
            const { bizId } = await getBizContextForManagers();
            const check = await checkBookingBelongsToBusiness(booking_id, bizId);
            if (!check.belongs) {
                return {
                    ok: false,
                    status: 403,
                    error: 'forbidden',
                    message: 'Доступ запрещен',
                };
            }
        } catch {
            return {
                ok: false,
                status: 403,
                error: 'forbidden',
                message: 'Доступ запрещен',
            };
        }
    }

    return deliverStoredBookingNotification(supabase, admin, booking, type, { apiKey, from });
}

/** Internal delivery only. Callers must authorize the command before reaching here. */
export async function deliverStoredBookingNotification(
    supabase: SupabaseClient,
    admin: SupabaseClient,
    booking: BookingRow,
    type: NotifyBookingInput['type'],
    config: { apiKey: string; from: string },
): Promise<NotifyBookingResult> {
    const bookingDataService = new BookingDataService(admin);
    const ownerEmail = await bookingDataService.getOwnerEmailFromBusiness(booking.biz);
    const orchestrator = new NotificationOrchestrator(supabase, admin, {
        ...config,
        replyTo: ownerEmail ?? undefined,
    });

    const resultHolder = { value: null as NotificationResult | null };
    const notifications: BookingNotificationPort = {
        async send(bookingId, notifyType) {
            if (bookingId !== booking.id) {
                throw new Error('Booking id mismatch in notify adapter');
            }

            resultHolder.value = await orchestrator.sendNotifications(booking, notifyType);
        },
    };

    await sendBookingNotificationsUseCase(notifications, booking.id, type);

    const result = resultHolder.value;
    if (!result) {
        logError('Notify', 'Use case completed but no result from adapter', undefined);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось отправить уведомления',
        };
    }

    logDebug('Notify', 'Notifications completed', result);
    return {
        ok: true,
        data: {
            sent: result.emailsSent,
            whatsappSent: result.whatsappSent,
            telegramSent: result.telegramSent,
        },
    };
}
