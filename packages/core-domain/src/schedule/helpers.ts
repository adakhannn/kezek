/**
 * Чистые помощники для работы с расписанием и слотами.
 *
 * Здесь нет зависимостей от Supabase или React — только работа с данными.
 */

import type {
    RawSlot,
    Slot,
    TemporaryTransfer,
    StaffInfo,
    ScheduleContext,
    SlotFilterContext,
} from './types';

/**
 * Вычисляет контекст расписания (временный перевод и целевой филиал)
 * на основании массива временных переводов и базовой информации о сотруднике.
 *
 * Логика отражает то, как сейчас работает useSlotsLoader в публичном бронировании.
 */
export function resolveScheduleContext(params: {
    staffId: string;
    dayStr: string;
    selectedBranchId: string;
    temporaryTransfers: TemporaryTransfer[];
    staff: StaffInfo[];
}): ScheduleContext {
    const { staffId, dayStr, selectedBranchId, temporaryTransfers, staff } = params;

    const staffCurrent = staff.find((m) => m.id === staffId);
    const homeBranchId = staffCurrent?.branch_id;

    const isTemporaryTransfer =
        !!dayStr &&
        temporaryTransfers.some((t) => t.staff_id === staffId && t.date === dayStr);

    let targetBranchId = selectedBranchId;

    if (isTemporaryTransfer && dayStr) {
        const tempTransfer = temporaryTransfers.find(
            (t) => t.staff_id === staffId && t.date === dayStr,
        );
        if (tempTransfer) {
            targetBranchId = tempTransfer.branch_id;
        }
    }

    return {
        isTemporaryTransfer,
        targetBranchId,
        homeBranchId,
    };
}

/**
 * Фильтрует слоты по контексту:
 * - по мастеру (или любому мастеру для staffId === 'any');
 * - по минимальному времени начала;
 * - по филиалу (учитывая временный перевод).
 */
export function filterSlotsByContext(
    slots: RawSlot[],
    context: SlotFilterContext,
): Slot[] {
    const {
        staffId,
        branchId,
        targetBranchId,
        isTemporaryTransfer,
        minStart,
    } = context;

    const effectiveMinStart =
        minStart ?? new Date(Date.now() + 30 * 60 * 1000); // дефолт — как в текущей логике

    return slots.filter((s) => {
        // Если выбран конкретный мастер, фильтруем по нему.
        if (staffId !== 'any' && s.staff_id !== staffId) {
            return false;
        }

        // Фильтрация по минимальному времени.
        if (new Date(s.start_at) <= effectiveMinStart) {
            return false;
        }

        // Для временно переведённого мастера принимаем слоты только из филиала временного перевода.
        if (isTemporaryTransfer && targetBranchId) {
            return s.branch_id === targetBranchId;
        }

        // Для обычного мастера принимаем слоты из выбранного филиала.
        return s.branch_id === branchId;
    });
}


