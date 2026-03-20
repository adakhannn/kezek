import { formatInTimeZone } from 'date-fns-tz';

import { logDebug, logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

type Params = {
    fromPhone: string;
    bookingId: string | null;
    clientId: string | null;
};

export async function handleWhatsAppCancelCommand({
    fromPhone,
    bookingId,
    clientId,
}: Params) {
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для отмены.',
        });
        return;
    }

    try {
        const admin = getServiceClient();

        const { data: booking } = await admin
            .from('bookings')
            .select('id, status, start_at, client_id, client_phone, services(name_ru), staff(full_name)')
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Бронирование не найдено.',
            });
            return;
        }

        const belongsToSender =
            (booking.client_phone && booking.client_phone === fromPhone) ||
            (booking.client_id && clientId && booking.client_id === clientId);
        if (!belongsToSender) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование не связано с вашим номером. Используйте номер телефона, указанный при записи.',
            });
            return;
        }

        if (booking.status === 'cancelled') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование уже отменено.',
            });
            return;
        }

        const { error: cancelError } = await admin.rpc('cancel_booking', {
            p_booking_id: bookingId,
        });

        if (cancelError) {
            logError('WhatsAppWebhook', 'Failed to cancel booking', { error: cancelError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось отменить бронирование. Пожалуйста, попробуйте позже или свяжитесь с нами.',
            });
            return;
        }

        const servicesForCancel = booking.services as
            | { name_ru?: string }[]
            | { name_ru?: string }
            | null
            | undefined;
        const staffForCancel = booking.staff as
            | { full_name?: string }[]
            | { full_name?: string }
            | null
            | undefined;

        const serviceName =
            Array.isArray(servicesForCancel)
                ? servicesForCancel[0]?.name_ru || 'услуга'
                : servicesForCancel?.name_ru || 'услуга';

        const staffName =
            Array.isArray(staffForCancel)
                ? staffForCancel[0]?.full_name || 'мастер'
                : staffForCancel?.full_name || 'мастер';
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `Бронирование отменено.\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}\n\nЕсли у вас есть вопросы, свяжитесь с нами.`,
        });

        logDebug('WhatsAppWebhook', 'Booking cancelled via WhatsApp', { bookingId, fromPhone });
    } catch (error) {
        logError('WhatsAppWebhook', 'Error in cancel command', { error, bookingId, fromPhone });
        await sendWhatsApp({
            to: fromPhone,
            text: 'Произошла ошибка при отмене бронирования. Пожалуйста, попробуйте позже.',
        });
    }
}

export async function handleWhatsAppConfirmCommand({
    fromPhone,
    bookingId,
    clientId,
}: Params) {
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для подтверждения.',
        });
        return;
    }

    try {
        const admin = getServiceClient();

        const { data: booking } = await admin
            .from('bookings')
            .select('id, status, start_at, client_id, client_phone, services(name_ru), staff(full_name)')
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Бронирование не найдено.',
            });
            return;
        }

        const belongsToSender =
            (booking.client_phone && booking.client_phone === fromPhone) ||
            (booking.client_id && clientId && booking.client_id === clientId);
        if (!belongsToSender) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование не связано с вашим номером. Используйте номер телефона, указанный при записи.',
            });
            return;
        }

        if (booking.status === 'confirmed' || booking.status === 'paid') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование уже подтверждено.',
            });
            return;
        }

        if (booking.status === 'cancelled') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование было отменено и не может быть подтверждено.',
            });
            return;
        }

        const { error: confirmError } = await admin.rpc('confirm_booking', {
            p_booking_id: bookingId,
        });

        if (confirmError) {
            logError('WhatsAppWebhook', 'Failed to confirm booking', { error: confirmError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось подтвердить бронирование. Пожалуйста, попробуйте позже или свяжитесь с нами.',
            });
            return;
        }

        const servicesForConfirm = booking.services as
            | { name_ru?: string }[]
            | { name_ru?: string }
            | null
            | undefined;
        const staffForConfirm = booking.staff as
            | { full_name?: string }[]
            | { full_name?: string }
            | null
            | undefined;

        const serviceName =
            Array.isArray(servicesForConfirm)
                ? servicesForConfirm[0]?.name_ru || 'услуга'
                : servicesForConfirm?.name_ru || 'услуга';

        const staffName =
            Array.isArray(staffForConfirm)
                ? staffForConfirm[0]?.full_name || 'мастер'
                : staffForConfirm?.full_name || 'мастер';
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `Бронирование подтверждено!\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}\n\nЖдем вас! Если возникнут вопросы, напишите нам.`,
        });

        logDebug('WhatsAppWebhook', 'Booking confirmed via WhatsApp', { bookingId, fromPhone });
    } catch (error) {
        logError('WhatsAppWebhook', 'Error in confirm command', { error, bookingId, fromPhone });
        await sendWhatsApp({
            to: fromPhone,
            text: 'Произошла ошибка при подтверждении бронирования. Пожалуйста, попробуйте позже.',
        });
    }
}
