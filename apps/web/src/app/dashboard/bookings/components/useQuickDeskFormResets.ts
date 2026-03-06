'use client';

import { useEffect } from 'react';

import { todayStringInTz } from '@/lib/time';

export type UseQuickDeskFormResetsParams = {
    branchId: string;
    timezone: string;
    date: string;
    staffId: string;
    setDate: (date: string) => void;
    setServiceId: (id: string) => void;
    setStaffId: (id: string) => void;
    clearSlots: () => void;
};

/**
 * Инкапсулирует сброс полей формы при смене филиала, даты или мастера.
 * Убирает цепочку из трёх отдельных useEffect из компонента.
 */
export function useQuickDeskFormResets(params: UseQuickDeskFormResetsParams) {
    const {
        branchId,
        timezone,
        date,
        staffId,
        setDate,
        setServiceId,
        setStaffId,
        clearSlots,
    } = params;

    useEffect(() => {
        setDate(todayStringInTz(timezone));
        setServiceId('');
        setStaffId('');
        clearSlots();
    }, [branchId, timezone]);

    useEffect(() => {
        setStaffId('');
        setServiceId('');
        clearSlots();
    }, [date]);

    useEffect(() => {
        setServiceId('');
        clearSlots();
    }, [staffId]);
}
