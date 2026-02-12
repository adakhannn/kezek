/**
 * Оптимизированный хук для загрузки данных финансов с использованием React Query
 * Заменяет useShiftData с улучшенным кэшированием и производительностью
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { useMemo } from 'react';

import type { Booking, ServiceName, Shift, ShiftItem, Stats } from '../types';
import { fetchWithRetry } from '../utils/networkRetry';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';

export interface FinanceData {
    shift: Shift | null;
    items: ShiftItem[];
    bookings: Booking[];
    services: ServiceName[];
    allShifts: Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }>;
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
    stats?: Stats;
}

export interface FinanceDataResponse {
    ok: true;
    today: {
        exists: boolean;
        status: 'open' | 'closed' | 'none';
        shift: Shift | null;
        items: ShiftItem[];
    };
    bookings: Booking[];
    services: ServiceName[];
    allShifts: Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }>;
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
    stats?: Stats;
}

interface UseFinanceDataOptions {
    staffId?: string;
    date: Date;
    enabled?: boolean;
}

interface UseFinanceDataReturn {
    data: FinanceData | null;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    invalidate: () => void;
}

/**
 * Функция загрузки данных с сервера
 */
async function fetchFinanceData(
    staffId: string | undefined,
    date: Date,
    signal?: AbortSignal
): Promise<FinanceDataResponse> {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const apiUrl = staffId
        ? `/api/staff/finance?staffId=${encodeURIComponent(staffId)}&date=${dateStr}`
        : `/api/staff/finance?date=${dateStr}`;

    const res = await fetchWithRetry(
        apiUrl,
        {
            cache: 'no-store',
            signal,
        },
        {
            retries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            scope: 'FinanceData',
        }
    );

    if (!res.ok) {
        let errorMessage = 'Не удалось загрузить данные смены';
        try {
            const errorJson = await res.json();
            errorMessage = errorJson?.error || errorJson?.message || errorMessage;
        } catch {
            // Используем стандартное сообщение
        }
        throw new Error(errorMessage);
    }

    const json = await res.json();
    if (!json.ok) {
        throw new Error(json.error || 'Не удалось загрузить данные смены');
    }

    return json as FinanceDataResponse;
}

/**
 * Оптимизированный хук для загрузки данных финансов
 * Использует адаптивные настройки кэширования в зависимости от даты
 */
export function useFinanceData({
    staffId,
    date,
    enabled = true,
}: UseFinanceDataOptions): UseFinanceDataReturn {
    const { t } = useLanguage();
    const toast = useToast();
    const queryClient = useQueryClient();

    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const queryKey = ['finance', staffId || 'current', dateStr];

    // Определяем, является ли дата сегодняшней
    const todayStr = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const isToday = dateStr === todayStr;

    // Адаптивные настройки кэширования:
    // - Для сегодняшней смены: данные могут обновляться чаще (5 секунд)
    // - Для прошлых дат: данные редко меняются (30 секунд)
    // - Для статистики (allShifts): данные меняются редко (5 минут)
    const staleTime = isToday 
        ? 5 * 1000  // 5 секунд для текущей смены
        : 30 * 1000; // 30 секунд для прошлых дат
    
    const gcTime = isToday
        ? 5 * 60 * 1000  // 5 минут для текущей смены
        : 10 * 60 * 1000; // 10 минут для прошлых дат (можно хранить дольше)

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => fetchFinanceData(staffId, date, signal),
        enabled,
        staleTime,
        gcTime,
        refetchOnWindowFocus: false, // Не рефетчить при фокусе (полагаемся на invalidateQueries)
        refetchOnReconnect: isToday, // Рефетчить при переподключении только для текущей смены
        refetchOnMount: false, // Не рефетчить при монтировании, если данные свежие
        retry: (failureCount, error) => {
            // Не повторяем для ошибок авторизации
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('unauthorized') || msg.includes('401')) {
                    return false;
                }
            }
            return failureCount < 2; // Максимум 2 попытки
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    });

    // Преобразуем данные в удобный формат
    const data = useMemo<FinanceData | null>(() => {
        if (!query.data) return null;

        const response = query.data;
        return {
            shift: response.today.shift,
            items: response.today.items || [],
            bookings: response.bookings || [],
            services: response.services || [],
            allShifts: response.allShifts || [],
            staffPercentMaster: response.staffPercentMaster ?? 60,
            staffPercentSalon: response.staffPercentSalon ?? 40,
            hourlyRate: response.hourlyRate ?? null,
            currentHoursWorked: response.currentHoursWorked ?? null,
            currentGuaranteedAmount: response.currentGuaranteedAmount ?? null,
            isDayOff: response.isDayOff ?? false,
            stats: response.stats,
        };
    }, [query.data]);

    // Обработка ошибок
    if (query.isError && query.error) {
        const error = query.error instanceof Error ? query.error : new Error(String(query.error));
        // Показываем ошибку только если это не ошибка авторизации (она обрабатывается на уровне layout)
        if (!error.message.toLowerCase().includes('unauthorized')) {
            toast.showError(error.message);
        }
    }

    return {
        data,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error instanceof Error ? query.error : query.error ? new Error(String(query.error)) : null,
        refetch: async () => {
            await query.refetch();
        },
        invalidate: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    };
}

