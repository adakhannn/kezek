/**
 * Оптимизированные мутации для работы с финансами
 * Использует React Query для оптимистичных обновлений и кэширования
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem } from '../types';

import type { FinanceDataResponse } from './useFinanceData';

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
        onMutate: async () => {
            // Отменяем исходящие запросы для оптимистичного обновления
            await queryClient.cancelQueries({ queryKey });

            // Сохраняем предыдущее состояние
            const previousData = queryClient.getQueryData(queryKey);

            // Оптимистично обновляем кэш - устанавливаем смену как открытую
            queryClient.setQueryData(queryKey, (old: FinanceDataResponse | undefined) => {
                if (!old) return old;
                
                const now = new Date().toISOString();
                const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                
                // Создаем оптимистичную смену
                const optimisticShift = {
                    id: old.today?.shift?.id || `temp-${Date.now()}`,
                    shift_date: dateStr,
                    opened_at: now,
                    closed_at: null,
                    expected_start: null,
                    late_minutes: 0,
                    status: 'open' as const,
                    total_amount: 0,
                    consumables_amount: 0,
                    master_share: 0,
                    salon_share: 0,
                    percent_master: old.staffPercentMaster ?? 60,
                    percent_salon: old.staffPercentSalon ?? 40,
                    hours_worked: null,
                    hourly_rate: old.hourlyRate ?? null,
                    guaranteed_amount: null,
                    topup_amount: null,
                };

                return {
                    ...old,
                    today: {
                        exists: true,
                        status: 'open' as const,
                        shift: optimisticShift,
                        items: old.today?.items || [],
                    },
                };
            });

            return { previousData };
        },
        onError: (error: Error, variables, context) => {
            // Откатываем изменения при ошибке
            if (context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            toast.showError(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.showSuccess(t('staff.finance.shift.opened', 'Смена успешно открыта'));
        },
    });

    // Мутация закрытия смены
    const closeShiftMutation = useMutation({
        mutationFn: (items: ShiftItem[]) => closeShift(staffId, date, items),
        onMutate: async (items) => {
            // Отменяем исходящие запросы для оптимистичного обновления
            await queryClient.cancelQueries({ queryKey });

            // Сохраняем предыдущее состояние
            const previousData = queryClient.getQueryData(queryKey);

            // Вычисляем суммы из items для оптимистичного обновления
            const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
            const consumablesAmount = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);
            
            // Оптимистично обновляем кэш - устанавливаем смену как закрытую
            queryClient.setQueryData(queryKey, (old: FinanceDataResponse | undefined) => {
                if (!old || !old.today?.shift) return old;
                
                const now = new Date().toISOString();
                
                // Вычисляем доли (упрощенно, без учета гарантированной суммы)
                const percentMaster = old.staffPercentMaster ?? 60;
                const percentSalon = old.staffPercentSalon ?? 40;
                const percentSum = percentMaster + percentSalon || 100;
                const masterShare = Math.round((totalAmount * percentMaster) / percentSum);
                const salonShare = Math.round((totalAmount * percentSalon) / percentSum) + consumablesAmount;

                // Обновляем смену
                const optimisticShift = {
                    ...old.today.shift,
                    status: 'closed' as const,
                    closed_at: now,
                    total_amount: totalAmount,
                    consumables_amount: consumablesAmount,
                    master_share: masterShare,
                    salon_share: salonShare,
                };

                return {
                    ...old,
                    today: {
                        exists: true,
                        status: 'closed' as const,
                        shift: optimisticShift,
                        items: old.today.items || [],
                    },
                };
            });

            return { previousData };
        },
        onError: (error: Error, variables, context) => {
            // Откатываем изменения при ошибке
            if (context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            toast.showError(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.showSuccess(t('staff.finance.shift.closed', 'Смена успешно закрыта'));
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

