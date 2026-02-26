import type { BranchRepository, BookingRepository } from '../ports';
import type { BookingStatus, CreateBookingParams, PromotionApplicationResult } from './types';

/**
 * Порт для команд над бронированиями, реализуемый инфраструктурой (Supabase RPC и т.п.).
 */
export interface BookingCommandsPort {
    holdSlot(params: {
        bizId: string;
        branchId: string;
        serviceId: string;
        staffId: string;
        startAt: string;
    }): Promise<string>; // bookingId

    confirmBooking(bookingId: string): Promise<void>;

    cancelBooking(bookingId: string): Promise<void>;
}

/**
 * Порт для отправки уведомлений по событиям бронирований.
 */
export interface BookingNotificationPort {
    send(bookingId: string, type: 'hold' | 'confirm' | 'cancel'): Promise<void>;
}

type CreateBookingDeps = {
    branchRepository: BranchRepository;
    commands: BookingCommandsPort;
    notifications?: BookingNotificationPort;
};

/**
 * Use-case: создание и автоматическое подтверждение бронирования.
 *
 * Отвечает за выбор/проверку филиала и последовательность:
 * 1) holdSlot → 2) confirmBooking → 3) уведомление (confirm).
 *
 * Валидация входных данных (формат, UUID и т.п.) должна выполняться выше
 * через Zod/validateCreateBookingParams — сюда поступают уже нормализованные данные.
 */
export async function createBookingUseCase(
    deps: CreateBookingDeps,
    params: CreateBookingParams,
): Promise<{ bookingId: string }> {
    const { branchRepository, commands, notifications } = deps;

    // Определяем филиал: либо проверяем переданный, либо подбираем первый активный.
    let targetBranchId: string | null = null;

    if (params.branch_id) {
        const branch = await branchRepository.findActiveById({
            bizId: params.biz_id,
            branchId: params.branch_id,
        });

        if (!branch) {
            throw new Error('BRANCH_NOT_FOUND_OR_INACTIVE');
        }

        targetBranchId = branch.id;
    } else {
        const branch = await branchRepository.findFirstActiveByBizId(params.biz_id);

        if (!branch) {
            throw new Error('NO_ACTIVE_BRANCH_FOR_BIZ');
        }

        targetBranchId = branch.id;
    }

    // Создаём hold-бронирование.
    const bookingId = await commands.holdSlot({
        bizId: params.biz_id,
        branchId: targetBranchId,
        serviceId: params.service_id,
        staffId: params.staff_id,
        startAt: params.start_at,
    });

    // Подтверждаем.
    await commands.confirmBooking(bookingId);

    // Отправляем уведомление о подтверждении (если порт передан).
    if (notifications) {
        await notifications.send(bookingId, 'confirm');
    }

    return { bookingId };
}

type SimpleBookingDeps = {
    commands: BookingCommandsPort;
    notifications?: BookingNotificationPort;
};

/**
 * Use-case: отмена бронирования.
 */
export async function cancelBookingUseCase(
    deps: SimpleBookingDeps,
    bookingId: string,
): Promise<void> {
    const { commands, notifications } = deps;

    await commands.cancelBooking(bookingId);

    if (notifications) {
        await notifications.send(bookingId, 'cancel');
    }
}

/**
 * Use-case: подтверждение уже существующего бронирования.
 */
export async function confirmBookingUseCase(
    deps: SimpleBookingDeps,
    bookingId: string,
): Promise<void> {
    const { commands, notifications } = deps;

    await commands.confirmBooking(bookingId);

    if (notifications) {
        await notifications.send(bookingId, 'confirm');
    }
}

/**
 * Use-case: только отправка уведомления по бронированию.
 * Удобен, когда статус уже изменён, а нужно лишь фан-аутнуть уведомления.
 */
export async function sendBookingNotificationsUseCase(
    notifications: BookingNotificationPort,
    bookingId: string,
    type: 'hold' | 'confirm' | 'cancel',
): Promise<void> {
    await notifications.send(bookingId, type);
}

type MarkAttendanceDeps = {
    bookingRepository: BookingRepository;
    now?: () => Date;
};

export type MarkAttendanceParams = {
    bookingId: string;
    bizId: string;
    attended: boolean;
};

type MarkAttendanceDomainError =
    | 'BOOKING_NOT_FOUND'
    | 'BOOKING_NOT_IN_BIZ'
    | 'BOOKING_NOT_IN_PAST'
    | 'BOOKING_ALREADY_FINAL';

export type MarkAttendanceDecision =
    | {
          ok: true;
          newStatus: BookingStatus;
          applyPromotion: boolean;
          currentStatus: BookingStatus;
      }
    | {
          ok: false;
          reason: MarkAttendanceDomainError;
          currentStatus?: BookingStatus;
      };

/**
 * Use-case: доменное решение по отметке посещения.
 *
 * Не знает про Supabase/RPC — только про:
 * - принадлежность брони бизнесу,
 * - допустимость изменения статуса,
 * - выбор нового статуса и необходимости применения промо.
 */
export async function decideMarkAttendanceUseCase(
    deps: MarkAttendanceDeps,
    params: MarkAttendanceParams,
): Promise<MarkAttendanceDecision> {
    const { bookingRepository, now } = deps;

    const booking = await bookingRepository.findById(params.bookingId);

    if (!booking) {
        return { ok: false, reason: 'BOOKING_NOT_FOUND' };
    }

    if (booking.biz_id !== params.bizId) {
        return {
            ok: false,
            reason: 'BOOKING_NOT_IN_BIZ',
            currentStatus: booking.status,
        };
    }

    if (booking.status === 'paid' || booking.status === 'no_show') {
        return {
            ok: false,
            reason: 'BOOKING_ALREADY_FINAL',
            currentStatus: booking.status,
        };
    }

    const nowDate = now ? now() : new Date();
    const startAt = new Date(booking.start_at);

    if (Number.isNaN(startAt.getTime())) {
        return {
            ok: false,
            reason: 'BOOKING_NOT_IN_PAST',
            currentStatus: booking.status,
        };
    }

    if (startAt > nowDate) {
        return {
            ok: false,
            reason: 'BOOKING_NOT_IN_PAST',
            currentStatus: booking.status,
        };
    }

    const newStatus: BookingStatus = params.attended ? 'paid' : 'no_show';

    return {
        ok: true,
        newStatus,
        applyPromotion: newStatus === 'paid',
        currentStatus: booking.status,
    };
}

