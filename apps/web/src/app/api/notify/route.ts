// apps/web/src/app/api/notify/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sendBookingNotificationsUseCase } from '@core-domain/booking';
import type { BookingNotificationPort } from '@core-domain/booking';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getResendApiKey, getEmailFrom } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import type { NotificationResult } from '@/lib/notifications/types';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { notifyRequestSchema } from '@/lib/validation/schemas';

/**
 * API endpoint для отправки уведомлений о бронированиях.
 *
 * Использует доменный use-case sendBookingNotificationsUseCase и порт BookingNotificationPort;
 * реализация порта — NotificationOrchestrator (см. NOTIFICATIONS_PREFERENCES.md).
 *
 * Каналы: email (Resend), WhatsApp, Telegram. Для добавления push / in-app:
 * расширить NotificationChannel в @core-domain/ports и оркестратор (NOTIFICATIONS_PREFERENCES.md, §4).
 */
export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('Notify', async () => {
                logDebug('Notify', 'Endpoint called', { url: req.url, method: req.method });

                const validationResult = await validateRequest(req, notifyRequestSchema);
                if (!validationResult.success) {
                    return validationResult.response;
                }
                const { type, booking_id } = validationResult.data;

                logDebug('Notify', 'Received notification request', { type, booking_id: booking_id });

                let apiKey: string;
                try {
                    apiKey = getResendApiKey();
                } catch (error) {
                    logError('Notify', 'RESEND_API_KEY is not set', error);
                    return createErrorResponse('internal', 'RESEND_API_KEY is not set', undefined, 500);
                }

                const from = getEmailFrom();
                const { supabase, admin } = await createSupabaseClients();

                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
                }

                const bookingDataService = new BookingDataService(admin);
                const booking = await bookingDataService.getBookingById(booking_id);

                if (!booking) {
                    logError('Notify', 'Booking not found', { booking_id });
                    return createErrorResponse('not_found', 'Booking not found', undefined, 404);
                }

                const isClient = booking.client_id === user.id;
                if (!isClient) {
                    try {
                        const { bizId } = await getBizContextForManagers();
                        const check = await checkBookingBelongsToBusiness(booking_id, bizId);
                        if (!check.belongs) {
                            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                        }
                    } catch {
                        return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                    }
                }

                const ownerEmail = await bookingDataService.getOwnerEmailFromBusiness(booking.biz);
                const orchestrator = new NotificationOrchestrator(supabase, admin, {
                    apiKey,
                    from,
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

                await sendBookingNotificationsUseCase(notifications, booking_id, type);

                const result = resultHolder.value;
                if (!result) {
                    logError('Notify', 'Use case completed but no result from adapter', undefined);
                    return createErrorResponse(
                        'internal',
                        'Не удалось отправить уведомления',
                        undefined,
                        500,
                    );
                }

                logDebug('Notify', 'Notifications completed', result);
                return createSuccessResponse({
                    sent: result.emailsSent,
                    whatsappSent: result.whatsappSent,
                    telegramSent: result.telegramSent,
                });
            }),
    );
}
