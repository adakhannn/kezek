/**
 * Оптимизированный хук для загрузки данных финансов с использованием React Query
 * Заменяет useShiftData с улучшенным кэшированием и производительностью
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import React, { useMemo, useRef } from 'react';

import type { Booking, ServiceName, Shift, ShiftItem, Stats } from '../types';
import { fetchWithRetry } from '../utils/networkRetry';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';

export interface FinanceData {
    todayStatus: 'open' | 'closed' | 'none';
    todayExists: boolean;
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
    /** Присутствует только в ответе API; при initialData (SSR) может отсутствовать */
    ok?: true;
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
    /** Данные с сервера (SSR prefetch) — используются только для текущей даты, без отдельного запроса */
    initialData?: FinanceDataResponse | import('../services/shiftDataService').FinanceResponsePayload;
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

    // Жесткий таймаут для запроса финансов, чтобы не ждать по 15–20 секунд.
    // Если сервер зависает или долго отвечает, прерываем запрос и показываем
    // понятную ошибку пользователю.
    const timeoutMs = 8000;
    const controller = new AbortController();

    // Пробрасываем внешний signal (от React Query) в наш AbortController
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    let res: Response;
    try {
        res = await fetchWithRetry(
            apiUrl,
            {
                cache: 'no-store',
                signal: controller.signal,
            },
            {
                // Для основного запроса финансов полностью отключаем повторы:
                // если запрос не проходит, лучше быстро показать ошибку,
                // чем ждать несколько циклов ретраев.
                retries: 0,
                baseDelayMs: 500,
                maxDelayMs: 2000,
                scope: 'FinanceData',
            }
        );
    } catch (e) {
        // Преобразуем AbortError в более понятное сообщение о таймауте
        if (e instanceof Error && e.name === 'AbortError') {
            throw new Error('Превышено время ожидания ответа сервера по финансам. Попробуйте обновить страницу или повторить попытку позже.');
        }
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }

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

    // API возвращает { ok: true, data: { today, bookings, ... } }; храним в кэше только payload
    const payload = (json as { data?: FinanceDataResponse }).data;
    if (!payload) {
        throw new Error('Неверный формат ответа: отсутствует data');
    }
    return payload as FinanceDataResponse;
}

/**
 * Оптимизированный хук для загрузки данных финансов
 * Использует адаптивные настройки кэширования в зависимости от даты
 */
export function useFinanceData({
    staffId,
    date,
    enabled = true,
    initialData: initialDataProp,
}: UseFinanceDataOptions): UseFinanceDataReturn {
    const { t: _t } = useLanguage();
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
    
    // Увеличиваем gcTime для прошлых дат, чтобы они хранились дольше в кэше
    // Это позволяет мгновенно переключаться между недавно просмотренными датами
    const gcTime = isToday
        ? 5 * 60 * 1000  // 5 минут для текущей смены
        : 60 * 60 * 1000; // 60 минут для прошлых дат - храним в кэше час для быстрой навигации

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => fetchFinanceData(staffId, date, signal),
        enabled,
        initialData: isToday && initialDataProp ? initialDataProp : undefined,
        staleTime,
        gcTime,
        refetchOnWindowFocus: false, // Не рефетчить при фокусе (полагаемся на invalidateQueries)
        refetchOnReconnect: isToday, // Рефетчить при переподключении только для текущей смены
        refetchOnMount: false, // Не рефетчить при монтировании, если данные свежие
        // Отключаем встроенные retry React Query, так как у нас уже есть
        // собственная логика повторов в fetchWithRetry. Это предотвращает
        // удвоение количества попыток и длинные «подвисания» запросов.
        retry: false,
    });

    // Преобразуем данные в удобный формат (защита от отсутствия response.today — например, при «Бизнес не найден»)
    const data = useMemo<FinanceData | null>(() => {
        if (!query.data) return null;

        const response = query.data as FinanceDataResponse;
        const today = response.today;
        if (!today) {
            return null;
        }
        return {
            todayStatus: today.status,
            todayExists: today.exists,
            shift: today.shift ?? null,
            items: today.items ?? [],
            bookings: response.bookings ?? [],
            services: response.services ?? [],
            allShifts: response.allShifts ?? [],
            staffPercentMaster: response.staffPercentMaster ?? 60,
            staffPercentSalon: response.staffPercentSalon ?? 40,
            hourlyRate: response.hourlyRate ?? null,
            currentHoursWorked: response.currentHoursWorked ?? null,
            currentGuaranteedAmount: response.currentGuaranteedAmount ?? null,
            isDayOff: response.isDayOff ?? false,
            stats: response.stats,
        };
    }, [query.data]);

    // Обработка ошибок (через useEffect, чтобы избежать бесконечных перерисовок)
    // Храним последнее показанное сообщение, чтобы не спамить тостами при одном и том же query.error
    const lastErrorMessageRef = useRef<string | null>(null);

    React.useEffect(() => {
        if (query.isError && query.error) {
            const error = query.error instanceof Error ? query.error : new Error(String(query.error));
            const message = error.message;

            // Показываем ошибку только если это не ошибка авторизации (она обрабатывается на уровне layout)
            // и если мы ещё не показывали тост с таким текстом
            if (
                !message.toLowerCase().includes('unauthorized') &&
                lastErrorMessageRef.current !== message
            ) {
                lastErrorMessageRef.current = message;
                toast.showError(message);
            }
        } else if (!query.isError) {
            // Сбрасываем, когда ошибки больше нет (например, после успешного refetch)
            lastErrorMessageRef.current = null;
        }
    }, [query.isError, query.error]);

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

