/** The keys of the cancellation messages (bookings dictionaries). */
export type BookingCancellationMessageKey =
    | 'bookings.cancelError.notFound'
    | 'bookings.cancelError.forbidden'
    | 'bookings.cancelError.financialReversalRequired'
    | 'bookings.cancelError.notCancellable'
    | 'bookings.cancelError.alreadyStarted'
    | 'bookings.cancelError.changed';
type Translate = (key: BookingCancellationMessageKey, fallback: string) => string;

// Server callers (HTTP routes, mobile) keep the Russian text, which src/lib/serverMessages.ts translates
// in API responses (the server.booking.* dictionaries).
const russian: Translate = (_key, fallback) => fallback;

/**
 * Stable public errors shared by mobile, dashboard and HTTP cancellation. The dashboard passes its t,
 * so the message is in the UI language (FE-10).
 */
export function bookingCancellationError(error: unknown, t: Translate = russian): {
    ok: false;
    error: 'not_found' | 'forbidden' | 'financial_reversal_required' | 'not_cancellable' | 'booking_already_started' | 'booking_changed';
    message: string;
    status: 403 | 404 | 409;
} | null {
    const code = error && typeof error === 'object' && 'message' in error
        ? String(error.message) : '';
    switch (code) {
        case 'BOOKING_NOT_FOUND':
            return { ok: false, error: 'not_found', status: 404, message: t('bookings.cancelError.notFound', 'Бронирование не найдено') };
        case 'BOOKING_FORBIDDEN':
            return { ok: false, error: 'forbidden', status: 403, message: t('bookings.cancelError.forbidden', 'Нет доступа к отмене этой записи') };
        case 'BOOKING_FINANCIAL_REVERSAL_REQUIRED':
            return { ok: false, error: 'financial_reversal_required', status: 409,
                message: t('bookings.cancelError.financialReversalRequired', 'Запись оплачена, учтена в смене или использует списанную льготу. Обратитесь в организацию для финансового возврата перед отменой.') };
        case 'BOOKING_STATUS_NOT_CANCELLABLE':
            return { ok: false, error: 'not_cancellable', status: 409, message: t('bookings.cancelError.notCancellable', 'Запись в этом статусе нельзя отменить') };
        // R25-10: the client cancels only before the start; from then on the business decides.
        case 'BOOKING_ALREADY_STARTED':
            return { ok: false, error: 'booking_already_started', status: 409,
                message: t('bookings.cancelError.alreadyStarted', 'Запись уже началась. Отменить её теперь может только организация.') };
        case 'BOOKING_CHANGED':
            return { ok: false, error: 'booking_changed', status: 409, message: t('bookings.cancelError.changed', 'Запись изменилась. Обновите её перед повторной отменой.') };
        default:
            return null;
    }
}
