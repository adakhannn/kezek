/**
 * Правила переходов статусов бронирования.
 * Чистые функции для упрощения ветвлений в UI и use-case.
 */

import type { BookingStatus } from './types';

/** Статусы, после которых бронирование нельзя изменить (отмена, отметка посещения и т.д.) */
const TERMINAL_STATUSES: BookingStatus[] = ['paid', 'no_show', 'cancelled'];

/**
 * Проверяет, является ли статус конечным (переходы в другие статусы невозможны).
 */
export function isTerminalStatus(status: BookingStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
}

/**
 * Можно ли отменить бронирование (hold или confirmed).
 */
export function canCancel(status: BookingStatus): boolean {
    return status === 'hold' || status === 'confirmed';
}

/**
 * Можно ли подтвердить бронирование (только из hold).
 */
export function canConfirm(status: BookingStatus): boolean {
    return status === 'hold';
}

export type CanMarkAttendanceContext = {
    /** Время начала брони (для проверки «уже в прошлом») */
    bookingStartAt: Date | string;
    /** Текущее время (по умолчанию new Date()) */
    now?: Date;
};

/**
 * Можно ли выставить отметку посещения (пришел/не пришел).
 * Допустимы только hold и confirmed, время начала брони должно быть в прошлом.
 */
export function canMarkAttendance(
    status: BookingStatus,
    context: CanMarkAttendanceContext,
): boolean {
    if (isTerminalStatus(status)) return false;
    if (status !== 'hold' && status !== 'confirmed') return false;
    const start = typeof context.bookingStartAt === 'string' ? new Date(context.bookingStartAt) : context.bookingStartAt;
    const now = context.now ?? new Date();
    return start.getTime() <= now.getTime();
}

export type CanChangeStatusOptions = {
    /** Время начала брони (для переходов в paid/no_show — бронь должна быть в прошлом) */
    bookingStartAt?: Date | string;
    /** Текущее время */
    now?: Date;
};

/** Допустимые переходы: from -> to[] */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    hold: ['confirmed', 'cancelled'],
    confirmed: ['cancelled', 'paid', 'no_show'],
    paid: [],
    no_show: [],
    cancelled: [],
};

/**
 * Проверяет, допустим ли переход из статуса `from` в статус `to`.
 * Для переходов в paid/no_show дополнительно требуется, чтобы время брони было в прошлом.
 */
export function canChangeStatus(
    from: BookingStatus,
    to: BookingStatus,
    options?: CanChangeStatusOptions,
): boolean {
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) return false;

    if (to === 'paid' || to === 'no_show') {
        const start = options?.bookingStartAt;
        const now = options?.now ?? new Date();
        if (start == null) return false;
        const startDate = typeof start === 'string' ? new Date(start) : start;
        if (Number.isNaN(startDate.getTime())) return false;
        return startDate.getTime() <= now.getTime();
    }

    return true;
}
