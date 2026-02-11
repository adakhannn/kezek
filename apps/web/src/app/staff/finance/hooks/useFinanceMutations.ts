/**
 * Оптимизированные мутации для работы с финансами
 * Использует React Query для оптимистичных обновлений и кэширования
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';

interface UseFinanceMutationsOptions {
    staffId?: string;
    date: Date;
}

/**
 * Открытие смены
 */
async function openShift(staffId: string | undefined, date: Date): Promise<void> {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const url = staffId
        ? `/api/dashboard/staff/${staffId}/shift/open`
        : '/api/staff/shift/open';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
    });

    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Не удалось открыть смену');
    }
}

/**
 * Закрытие смены
 */
async function closeShift(
    staffId: string | undefined,
    date: Date,
    items: ShiftItem[]
): Promise<void> {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const url = staffId
        ? `/api/dashboard/staff/${staffId}/shift/close`
        : '/api/staff/shift/close';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: dateStr,
            items: items.map((item) => ({
                client_name: item.clientName,
                service_name: item.serviceName,
                service_amount: item.serviceAmount,
                consumables_amount: item.consumablesAmount,
                booking_id: item.bookingId,
            })),
        }),
    });

    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Не удалось закрыть смену');
    }
}

/**
 * Сохранение списка клиентов (синхронизация всего списка)
 */
async function saveShiftItems(
    staffId: string | undefined,
    date: Date,
    items: ShiftItem[]
): Promise<void> {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const url = '/api/staff/shift/items';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: items.map((item) => ({
                id: item.id,
                client_name: item.clientName,
                service_name: item.serviceName,
                service_amount: item.serviceAmount,
                consumables_amount: item.consumablesAmount,
                booking_id: item.bookingId,
            })),
            staffId: staffId || undefined,
            shiftDate: dateStr,
        }),
    });

    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Не удалось сохранить клиентов');
    }
}

/**
 * Хук для мутаций финансов
 */
export function useFinanceMutations({ staffId, date }: UseFinanceMutationsOptions) {
    const { t } = useLanguage();
    const toast = useToast();
    const queryClient = useQueryClient();

    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const queryKey = ['finance', staffId || 'current', dateStr];

    // Мутация открытия смены
    const openShiftMutation = useMutation({
        mutationFn: () => openShift(staffId, date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.showSuccess(t('staff.finance.shift.opened', 'Смена успешно открыта'));
        },
        onError: (error: Error) => {
            toast.showError(error.message);
        },
    });

    // Мутация закрытия смены
    const closeShiftMutation = useMutation({
        mutationFn: (items: ShiftItem[]) => closeShift(staffId, date, items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.showSuccess(t('staff.finance.shift.closed', 'Смена успешно закрыта'));
        },
        onError: (error: Error) => {
            toast.showError(error.message);
        },
    });

    // Мутация сохранения списка клиентов (синхронизация)
    const saveItemsMutation = useMutation({
        mutationFn: (items: ShiftItem[]) => saveShiftItems(staffId, date, items),
        onError: (error: Error) => {
            toast.showError(error.message);
        },
        onSuccess: () => {
            // Инвалидируем кэш для получения актуальных данных с сервера
            queryClient.invalidateQueries({ queryKey });
        },
    });

    return {
        openShift: openShiftMutation.mutateAsync,
        closeShift: closeShiftMutation.mutateAsync,
        saveItems: saveItemsMutation.mutateAsync,
        isOpening: openShiftMutation.isPending,
        isClosing: closeShiftMutation.isPending,
        isSaving: saveItemsMutation.isPending,
    };
}

