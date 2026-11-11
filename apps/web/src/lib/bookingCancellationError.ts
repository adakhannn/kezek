/** Stable public errors shared by mobile, dashboard and HTTP cancellation. */
export function bookingCancellationError(error: unknown): {
    ok: false;
    error: 'not_found' | 'forbidden' | 'financial_reversal_required' | 'not_cancellable' | 'booking_changed';
    message: string;
    status: 403 | 404 | 409;
} | null {
    const code = error && typeof error === 'object' && 'message' in error
        ? String(error.message) : '';
    switch (code) {
        case 'BOOKING_NOT_FOUND':
            return { ok: false, error: 'not_found', status: 404, message: 'Бронирование не найдено' };
        case 'BOOKING_FORBIDDEN':
            return { ok: false, error: 'forbidden', status: 403, message: 'Нет доступа к отмене этой записи' };
        case 'BOOKING_FINANCIAL_REVERSAL_REQUIRED':
            return { ok: false, error: 'financial_reversal_required', status: 409,
                message: 'Запись оплачена, учтена в смене или использует списанную льготу. Обратитесь в организацию для финансового возврата перед отменой.' };
        case 'BOOKING_STATUS_NOT_CANCELLABLE':
            return { ok: false, error: 'not_cancellable', status: 409, message: 'Запись в этом статусе нельзя отменить' };
        case 'BOOKING_CHANGED':
            return { ok: false, error: 'booking_changed', status: 409, message: 'Запись изменилась. Обновите её перед повторной отменой.' };
        default:
            return null;
    }
}
