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
    ServiceInfo,
} from './types';

/**
 * Вычисляет контекст расписания (временный перевод и целевой филиал)
 * на основании массива временных переводов и базовой информации о сотруднике.
 * Логика отражает useSlotsLoader в публичном бронировании.
 *
 * @param params - staffId, dayStr (YYYY-MM-DD), selectedBranchId, temporaryTransfers, staff
 * @returns ScheduleContext (isTemporaryTransfer, targetBranchId, homeBranchId)
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
 * Фильтрует слоты по контексту: мастер (или любой при staffId === 'any'),
 * минимальное время начала, филиал (с учётом временного перевода).
 *
 * @param slots - Массив сырых слотов (RawSlot)
 * @param context - SlotFilterContext (staffId, branchId, targetBranchId, isTemporaryTransfer, minStart)
 * @returns Отфильтрованный массив Slot
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

/**
 * Строит множество ID услуг, которые привязаны к указанному мастеру (service_staff).
 */
function getServiceIdsForStaff(
    serviceToStaffMap: Map<string, Set<string>>,
    staffId: string,
): Set<string> {
    const serviceIds = new Set<string>();
    for (const [sid, staffSet] of serviceToStaffMap.entries()) {
        if (staffSet.has(staffId)) {
            serviceIds.add(sid);
        }
    }
    return serviceIds;
}

/**
 * Проверяет, есть ли у услуги «похожая» в списке доступных мастеру:
 * та же name_ru, тот же duration_min, другой id, и эта другая привязана к мастеру.
 * Используется при временном переводе: мастер может оказывать услуги филиала по «эквиваленту» своей.
 */
function hasSimilarServiceLinkedToStaff(
    service: ServiceInfo,
    allServices: ServiceInfo[],
    servicesForStaff: Set<string>,
): boolean {
    return allServices.some(
        (s) =>
            s.id !== service.id &&
            s.name_ru === service.name_ru &&
            s.duration_min === service.duration_min &&
            servicesForStaff.has(s.id),
    );
}

/**
 * Фильтрует услуги по целевому филиалу и привязке к мастеру (service_staff).
 * При временном переводе допускает «похожие» услуги (одинаковые name_ru + duration_min),
 * привязанные к мастеру в другом филиале.
 * Специальное значение staffId === 'any': услуги филиала, которые выполняет хотя бы один мастер.
 *
 * @param params - services, targetBranchId, staffId, serviceToStaffMap, isTemporaryTransfer
 * @returns Отфильтрованный массив услуг
 */
export function filterServicesForStaff(params: {
    services: ServiceInfo[];
    targetBranchId: string;
    staffId: string;
    serviceToStaffMap: Map<string, Set<string>> | null;
    isTemporaryTransfer: boolean;
}): ServiceInfo[] {
    const { services, targetBranchId, staffId, serviceToStaffMap, isTemporaryTransfer } = params;

    let list = services.filter((s) => s.branch_id === targetBranchId);
    if (!serviceToStaffMap || serviceToStaffMap.size === 0) {
        return list;
    }

    if (staffId === 'any') {
        return list.filter(
            (s) => serviceToStaffMap.has(s.id) && serviceToStaffMap.get(s.id)!.size > 0,
        );
    }

    const servicesForStaff = getServiceIdsForStaff(serviceToStaffMap, staffId);
    if (isTemporaryTransfer) {
        list = list.filter(
            (s) =>
                servicesForStaff.has(s.id) ||
                hasSimilarServiceLinkedToStaff(s, services, servicesForStaff),
        );
    } else {
        list = list.filter((s) => servicesForStaff.has(s.id));
    }
    return list;
}


