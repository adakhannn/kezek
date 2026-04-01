import { formatInTimeZone } from 'date-fns-tz';

import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import { formatFirstWebhookValue } from '@/lib/whatsAppWebhookText';

export type WhatsAppBookingCommandKind = 'cancel' | 'confirm';

type CommandBookingRow = {
    id: string;
    status: string;
    start_at: string;
    end_at?: string | null;
    client_id?: string | null;
    client_phone?: string | null;
    services: { name_ru?: string }[] | { name_ru?: string } | null;
    staff: { full_name?: string }[] | { full_name?: string } | null;
};

export type BookingCommandDeps = {
    supabase: {
        from: (table: string) => {
            select: (columns: string) => {
                eq: (column: string, value: string) => {
                    maybeSingle: () => PromiseLike<{ data: CommandBookingRow | null }>;
                };
            };
        };
    };
    sendMessage: (text: string) => Promise<void>;
    runAction: (bookingId: string) => Promise<void>;
};

type ExecuteBookingCommandArgs = {
    kind: WhatsAppBookingCommandKind;
    fromPhone: string;
    bookingId: string | null;
    clientId: string | null;
};

function buildNoActiveBookingText(kind: WhatsAppBookingCommandKind): string {
    return kind === 'cancel'
        ? 'У вас нет активных бронирований для отмены.'
        : 'У вас нет активных бронирований для подтверждения.';
}

function buildAlreadyHandledText(kind: WhatsAppBookingCommandKind): string {
    return kind === 'cancel'
        ? 'Это бронирование уже отменено.'
        : 'Это бронирование уже подтверждено.';
}

function buildActionFailureText(kind: WhatsAppBookingCommandKind): string {
    return kind === 'cancel'
        ? 'Не удалось отменить бронирование. Пожалуйста, попробуйте позже.'
        : 'Не удалось подтвердить бронирование. Пожалуйста, попробуйте позже.';
}

function buildUnexpectedErrorText(kind: WhatsAppBookingCommandKind): string {
    return kind === 'cancel'
        ? 'Произошла ошибка при отмене бронирования. Пожалуйста, попробуйте позже.'
        : 'Произошла ошибка при подтверждении бронирования. Пожалуйста, попробуйте позже.';
}

function buildSuccessText(kind: WhatsAppBookingCommandKind, booking: CommandBookingRow): string {
    const actionText =
        kind === 'cancel' ? 'Бронирование отменено.' : 'Бронирование подтверждено.';
    const serviceName = formatFirstWebhookValue(booking.services, 'name_ru', 'услуга');
    const staffName = formatFirstWebhookValue(booking.staff, 'full_name', 'мастер');
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

    return `${actionText}\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}`;
}

function belongsToSender(
    booking: CommandBookingRow,
    fromPhone: string,
    clientId: string | null,
): boolean {
    return (
        (booking.client_phone && booking.client_phone === fromPhone) ||
        (booking.client_id && clientId && booking.client_id === clientId) ||
        false
    );
}

function isBlockedByStatus(kind: WhatsAppBookingCommandKind, booking: CommandBookingRow): string | null {
    if (kind === 'cancel') {
        return booking.status === 'cancelled' ? buildAlreadyHandledText(kind) : null;
    }

    if (booking.status === 'confirmed' || booking.status === 'paid') {
        return buildAlreadyHandledText(kind);
    }

    if (booking.status === 'cancelled') {
        return 'Это бронирование уже отменено и не может быть подтверждено.';
    }

    return null;
}

export async function executeWhatsAppBookingCommand(
    deps: BookingCommandDeps,
    args: ExecuteBookingCommandArgs,
): Promise<void> {
    const { kind, fromPhone, bookingId, clientId } = args;

    if (!bookingId) {
        await deps.sendMessage(buildNoActiveBookingText(kind));
        return;
    }

    try {
        const { data: booking } = await deps.supabase
            .from('bookings')
            .select(
                'id, status, start_at, end_at, client_id, client_phone, services(name_ru), staff(full_name)',
            )
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            await deps.sendMessage('Бронирование не найдено.');
            return;
        }

        if (!belongsToSender(booking, fromPhone, clientId)) {
            await deps.sendMessage('Это бронирование не связано с вашим номером телефона.');
            return;
        }

        const blockedText = isBlockedByStatus(kind, booking);
        if (blockedText) {
            await deps.sendMessage(blockedText);
            return;
        }

        try {
            await deps.runAction(bookingId);
        } catch (error) {
            logError('WhatsAppWebhook', `Failed to ${kind} booking`, { error, bookingId });
            await deps.sendMessage(buildActionFailureText(kind));
            return;
        }

        await deps.sendMessage(buildSuccessText(kind, booking));
    } catch (error) {
        logError('WhatsAppWebhook', `Error in ${kind} command`, { error, bookingId, fromPhone });
        await deps.sendMessage(buildUnexpectedErrorText(kind));
    }
}
