// apps/web/src/app/api/notify/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { 
    getResendApiKey, 
    getEmailFrom
} from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import type { NotifyRequest } from '@/lib/notifications/types';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

/**
 * API endpoint для отправки уведомлений о бронированиях
 * 
 * Поддерживает отправку уведомлений через:
 * - Email (Resend)
 * - WhatsApp
 * - Telegram
 * 
 * Получатели:
 * - Клиент (если включены уведомления)
 * - Мастер
 * - Владелец бизнеса
 * - Администраторы из списка email_notify_to
 */
export async function POST(req: Request) {
    return withErrorHandler('Notify', async () => {
        logDebug('Notify', 'Endpoint called', {
            url: req.url,
            method: req.method,
        });

        // Валидация запроса
        const body: NotifyRequest = await req.json();
        if (!body?.type || !body?.booking_id) {
            return createErrorResponse('validation', 'Missing type or booking_id', undefined, 400);
        }

        logDebug('Notify', 'Received notification request', {
            type: body.type,
            booking_id: body.booking_id,
        });

        // Получаем конфигурацию
        let apiKey: string;
        try {
            apiKey = getResendApiKey();
        } catch (error) {
            logError('Notify', 'RESEND_API_KEY is not set', error);
            return createErrorResponse('internal', 'RESEND_API_KEY is not set', undefined, 500);
        }

        const from = getEmailFrom();

        // Создаем Supabase клиенты используя унифицированные утилиты
        const { supabase, admin } = await createSupabaseClients();

        // Проверяем авторизацию пользователя
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Создаем сервис для получения данных бронирования
        const bookingDataService = new BookingDataService(admin);

        // Получаем данные бронирования
        const booking = await bookingDataService.getBookingById(body.booking_id);

        if (!booking) {
            logError('Notify', 'Booking not found', {
                booking_id: body.booking_id,
            });
            return createErrorResponse('not_found', 'Booking not found', undefined, 404);
        }

        // Проверяем права доступа к бронированию
        // Пользователь должен быть либо клиентом этого бронирования, либо менеджером бизнеса
        const isClient = booking.client_id === user.id;

        // Если не клиент, проверяем, является ли пользователь менеджером бизнеса
        if (!isClient) {
            try {
                const { bizId } = await getBizContextForManagers();
                const check = await checkBookingBelongsToBusiness(body.booking_id, bizId);
                if (!check.belongs) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            } catch {
                // Если не менеджер, доступ запрещен
                return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
            }
        }

        // Получаем email владельца для reply_to
        const ownerEmail = await bookingDataService.getOwnerEmailFromBusiness(booking.biz);

        // Создаем оркестратор уведомлений
        const orchestrator = new NotificationOrchestrator(
            supabase,
            admin,
            {
                apiKey,
                from,
                replyTo: ownerEmail ?? undefined,
            }
        );

        // Отправляем уведомления
        const result = await orchestrator.sendNotifications(booking, body.type);

        logDebug('Notify', 'Notifications completed', result);

        return createSuccessResponse({
            sent: result.emailsSent,
            whatsappSent: result.whatsappSent,
            telegramSent: result.telegramSent,
        });
    });
}
