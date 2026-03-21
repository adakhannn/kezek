import type { BranchRepository, BookingRepository } from '../ports';
import type { BookingStatus, CreateBookingParams } from './types';
import { validateBranchForBooking } from './validation';
import { isTerminalStatus, canMarkAttendance } from './statusTransitions';

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

    /**
     * Зарезервировать слот под комплекс услуг (несколько услуг за один визит).
     * Пока опционален: инфраструктура может реализовать тот же RPC что и holdSlot,
     * а доменная логика будет вызывать его только при наличии services в params.
     */
    holdComplexSlot?(params: {
        bizId: string;
        branchId: string;
        staffId: string;
        startAt: string;
        services: { service_id: string; duration_min: number; order_index?: number }[];
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

export type BookingErrorKind = 'BRANCH_NOT_FOUND_OR_INACTIVE' | 'NO_ACTIVE_BRANCH_FOR_BIZ';

export type BookingError = {
    kind: BookingErrorKind;
    message?: string;
};

export type CreateBookingResult =
    | {
          ok: true;
          bookingId: string;
      }
    | {
          ok: false;
          error: BookingError;
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
): Promise<CreateBookingResult> {
    const { branchRepository, commands, notifications } = deps;

    // Определяем филиал: либо проверяем переданный, либо подбираем первый активный.
    let targetBranchId: string | null = null;

    if (params.branch_id) {
        const branch = await branchRepository.findActiveById({
            bizId: params.biz_id,
            branchId: params.branch_id,
        });

        if (!validateBranchForBooking(branch)) {
            return {
                ok: false,
                error: {
                    kind: 'BRANCH_NOT_FOUND_OR_INACTIVE',
                    message: 'Branch not found or inactive',
                },
            };
        }

        targetBranchId = branch!.id;
    } else {
        const branch = await branchRepository.findFirstActiveByBizId(params.biz_id);

        if (!validateBranchForBooking(branch)) {
            return {
                ok: false,
                error: {
                    kind: 'NO_ACTIVE_BRANCH_FOR_BIZ',
                    message: 'No active branch for business',
                },
            };
        }

        targetBranchId = branch!.id;
    }

    // Создаём hold-бронирование.
    // Если передан массив services и инфраструктура поддерживает holdComplexSlot,
    // используем его, иначе остаёмся на классическом одноуслужном сценарии.
    let bookingId: string;
    if (params.services && params.services.length > 0 && commands.holdComplexSlot) {
        bookingId = await commands.holdComplexSlot({
            bizId: params.biz_id,
            branchId: targetBranchId,
            staffId: params.staff_id,
            startAt: params.start_at,
            services: params.services.map((s, index) => ({
                service_id: s.service_id,
                duration_min: s.duration_min,
                order_index: s.order_index ?? index,
            })),
        });
    } else {
        bookingId = await commands.holdSlot({
            bizId: params.biz_id,
            branchId: targetBranchId,
            serviceId: params.service_id,
            staffId: params.staff_id,
            startAt: params.start_at,
        });
    }

    // Подтверждаем.
    await commands.confirmBooking(bookingId);

    // Отправляем уведомление о подтверждении (если порт передан).
    if (notifications) {
        await notifications.send(bookingId, 'confirm');
    }

    return { ok: true, bookingId };
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

    if (isTerminalStatus(booking.status)) {
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

    if (!canMarkAttendance(booking.status, { bookingStartAt: startAt, now: nowDate })) {
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

