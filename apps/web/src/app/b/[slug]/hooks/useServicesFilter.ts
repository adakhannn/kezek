import { useMemo } from 'react';

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

/**
 * Хук для фильтрации услуг на основе выбранного мастера, филиала, даты и временных переводов
 * Использует функцию computeServicesFiltered для вычисления доступных услуг
 */
export function useServicesFilter(params: {
    services: Service[];
    servicesByBranch: Service[];
    staffId: string;
    branchId: string;
    dayStr: string;
    serviceToStaffMap: Map<string, Set<string>> | null;
    temporaryTransfers: TemporaryTransfer[];
}) {
    const { services, servicesByBranch, staffId, branchId, dayStr, serviceToStaffMap, temporaryTransfers } = params;

    const servicesFiltered = useMemo<Service[]>(() => {
        return computeServicesFiltered({
            services,
            servicesByBranch,
            staffId,
            branchId,
            dayStr,
            serviceToStaffMap,
            temporaryTransfers,
        });
    }, [services, servicesByBranch, staffId, branchId, dayStr, serviceToStaffMap, temporaryTransfers]);

    return servicesFiltered;
}

/**
 * Вычисляет отфильтрованный список услуг для выбранного мастера
 * Учитывает:
 * - Связи service_staff (какие услуги делает мастер)
 * - Временные переводы (мастер может делать услуги в другом филиале)
 * - Похожие услуги (если мастер делает похожую услугу, показываем и эту)
 */
function computeServicesFiltered(params: {
    services: Service[];
    servicesByBranch: Service[];
    staffId: string;
    branchId: string;
    dayStr: string;
    serviceToStaffMap: Map<string, Set<string>> | null;
    temporaryTransfers: TemporaryTransfer[];
}): Service[] {
    const { services, servicesByBranch, staffId, branchId, dayStr, serviceToStaffMap, temporaryTransfers } = params;

    if (!staffId) return [];
    if (!serviceToStaffMap) return [];

    // Находим все услуги, которые делает выбранный мастер
    const servicesForStaff = new Set<string>();
    for (const [serviceId, staffSet] of serviceToStaffMap.entries()) {
        if (staffSet.has(staffId)) {
            servicesForStaff.add(serviceId);
        }
    }

    // Проверяем, является ли выбранный мастер временно переведенным на выбранную дату
    const isTemporaryTransfer =
        !!dayStr &&
        !!staffId &&
        temporaryTransfers.some((t) => t.staff_id === staffId && t.date === dayStr);

    // Для временно переведенного мастера показываем услуги из филиала временного перевода
    // Для обычного мастера показываем услуги из выбранного филиала
    let targetBranchId = branchId;
    if (isTemporaryTransfer && dayStr) {
        const tempTransfer = temporaryTransfers.find(
            (t) => t.staff_id === staffId && t.date === dayStr
        );
        if (tempTransfer) {
            targetBranchId = tempTransfer.branch_id;
        }
    }

    // Фильтруем услуги: только услуги из целевого филиала (временного перевода или выбранного)
    // Для временно переведенного мастера: если связь service_staff есть для ЛЮБОЙ услуги с таким же названием,
    // то показываем услугу из филиала временного перевода (так как мастер умеет делать эту услугу, просто в другом филиале)
    const filtered = services.filter((s) => {
        // Проверяем, есть ли у мастера связь с этой услугой
        const hasServiceStaffLink = servicesForStaff.has(s.id);

        // Для временно переведенного мастера: если услуга в целевом филиале, но нет прямой связи service_staff,
        // проверяем, есть ли у мастера связь с услугой с таким же названием в другом филиале
        if (!hasServiceStaffLink && isTemporaryTransfer) {
            const hasSimilarServiceLink = services.some(
                (svc) =>
                    svc.name_ru === s.name_ru &&
                    svc.duration_min === s.duration_min &&
                    servicesForStaff.has(svc.id)
            );
            if (s.branch_id === targetBranchId && hasSimilarServiceLink) {
                return true;
            }
        }

        if (!hasServiceStaffLink) {
            return false;
        }

        const matchesTargetBranch = s.branch_id === targetBranchId;
        return matchesTargetBranch;
    });

    return filtered;
}

