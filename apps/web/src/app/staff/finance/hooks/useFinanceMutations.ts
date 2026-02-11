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
    
    if (staffId) {
        // Для владельца: дата передается через query параметр
        const url = `/api/dashboard/staff/${staffId}/shift/open?date=${dateStr}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            const json = await res.json();
            throw new Error(json.error || 'Не удалось открыть смену');
        }
    } else {
        // Для сотрудника: всегда открывает на сегодня, не принимает параметры
        const url = '/api/staff/shift/open';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            const json = await res.json();
            throw new Error(json.error || 'Не удалось открыть смену');
        }
    }
}

/**
 * Закрытие смены
 * Примечание: для владельца также используется /api/staff/shift/close,
 * так как отдельного endpoint для владельца нет
 */
async function closeShift(
    staffId: string | undefined,
    date: Date,
    items: ShiftItem[]
): Promise<void> {
    // Всегда используем endpoint для сотрудника
    // (владелец не может закрывать смены сотрудников - только сотрудник может закрыть свою смену)
    const url = '/api/staff/shift/close';

    // Преобразуем items в camelCase формат согласно closeShiftSchema
    const formattedItems = items.map((item) => ({
        id: item.id,
        clientName: item.clientName,
        serviceName: item.serviceName,
        serviceAmount: item.serviceAmount,
        consumablesAmount: item.consumablesAmount,
        bookingId: item.bookingId,
    }));

    // Согласно closeShiftSchema: либо items (массив), либо totalAmount должны быть указаны
    // Если items пустой, передаем totalAmount: 0
    const body: { items?: typeof formattedItems; totalAmount?: number } = {};
    
    if (formattedItems.length > 0) {
        body.items = formattedItems;
    } else {
        body.totalAmount = 0;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        let errorMessage = 'Не удалось закрыть смену';
        try {
            const json = await res.json();
            errorMessage = json.error || json.message || errorMessage;
        } catch {
            // Используем стандартное сообщение
        }
        throw new Error(errorMessage);
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

    // API ожидает items в camelCase формате согласно saveShiftItemsSchema
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: items.map((item) => ({
                id: item.id,
                clientName: item.clientName,
                serviceName: item.serviceName,
                serviceAmount: item.serviceAmount,
                consumablesAmount: item.consumablesAmount,
                bookingId: item.bookingId,
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

