import type { BranchRepository } from '../ports';
import type { CreateBookingParams } from './types';

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

