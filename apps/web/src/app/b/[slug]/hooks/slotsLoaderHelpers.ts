import { filterSlotsByContext, type Slot as ScheduleSlot } from '@core-domain/schedule';

type TranslateFn = (key: string, fallback?: string) => string;

type FilterSlotsArgs = {
    slots: ScheduleSlot[];
    staffId: string;
    branchId: string;
    targetBranchId: string;
    isTemporaryTransfer: boolean;
    minStart: Date;
};

export function buildSlotsCacheKey(dayStr: string, staffId: string, serviceId: string) {
    return `${dayStr}-${staffId}-${serviceId}`;
}

export function mapSlotsRpcErrorToMessage(args: {
    rpcMessage?: string | null;
    rpcCode?: string | null;
    t: TranslateFn;
}) {
    const { rpcMessage, rpcCode, t } = args;
    const errorMessage = rpcMessage || '';

    if (errorMessage.includes('not assigned') || errorMessage.includes('не прикрепл')) {
        return t(
            'booking.error.masterNotAssigned',
            'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.',
        );
    }

    if (errorMessage.includes('schedule') || errorMessage.includes('расписание')) {
        return t(
            'booking.error.noSchedule',
            'У выбранного мастера нет расписания на выбранный день. Выберите другой день.',
        );
    }

    if (errorMessage.includes('conflict') || errorMessage.includes('конфликт')) {
        return t(
            'booking.error.scheduleConflict',
            'Есть конфликт в расписании мастера на выбранный день. Выберите другой день или мастера.',
        );
    }

    if (rpcCode === 'PGRST301' || rpcCode === 'PGRST116') {
        return t(
            'booking.error.technical',
            'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.',
        );
    }

    return t(
        'booking.error.loadSlots',
        'Не удалось загрузить свободные слоты. Попробуйте выбрать другой день или мастера.',
    );
}

export function filterAndSortVisibleSlots(args: FilterSlotsArgs) {
    const { slots, staffId, branchId, targetBranchId, isTemporaryTransfer, minStart } = args;

    const filtered = filterSlotsByContext(slots, {
        staffId,
        branchId,
        targetBranchId,
        isTemporaryTransfer,
        minStart,
    });

    return filtered.sort((a, b) => {
        const timeA = new Date(a.start_at).getTime();
        const timeB = new Date(b.start_at).getTime();
        return timeA - timeB;
    });
}
