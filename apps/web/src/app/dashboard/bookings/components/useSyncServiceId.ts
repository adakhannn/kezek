'use client';

import { useEffect } from 'react';

import { logDebug } from '@/lib/log';

type ServiceRow = { id: string };

/**
 * Сбрасывает serviceId, если выбранная услуга не входит в список доступных
 * для текущих мастер/дата/филиал (servicesByBranch).
 */
export function useSyncServiceId(
    serviceId: string,
    setServiceId: (id: string) => void,
    staffId: string,
    date: string,
    servicesByBranch: ServiceRow[],
) {
    useEffect(() => {
        if (!staffId || !date || !serviceId) return;
        const isServiceValid = servicesByBranch.some((s) => s.id === serviceId);
        if (!isServiceValid) {
            logDebug('useSyncServiceId', 'Service not valid for current staff/date, clearing', {
                serviceId,
                staffId,
                date,
                availableIds: servicesByBranch.map((s) => s.id),
            });
            setServiceId('');
        }
    }, [staffId, date, servicesByBranch, serviceId, setServiceId]);
}
