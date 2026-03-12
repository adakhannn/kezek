import { filterSlotsByContext, resolveScheduleContext, type Slot as ScheduleSlot } from '@core-domain/schedule';
import { useEffect, useRef, useState } from 'react';


import { logDebug, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type Staff = {
    id: string;
    branch_id: string;
};

// Используем безопасное логирование из @/lib/log
// debugLog и debugWarn удалены - используйте logDebug и logWarn из @/lib/log

/**
 * Кэш для хранения загруженных слотов
 * Ключ: `${dayStr}-${staffId}-${serviceId}` (одна услуга) или `${dayStr}-${staffId}-complex-${sortedIds}` (комплекс)
 */
type CacheEntry = {
    slots: ScheduleSlot[];
    timestamp: number;
};

function buildSlotsCacheKey(dayStr: string, staffId: string, serviceIds: string[], totalDurationMin?: number): string {
    if (serviceIds.length <= 1) {
        return `${dayStr}-${staffId}-${serviceIds[0] ?? ''}`;
    }
    return `${dayStr}-${staffId}-complex-${totalDurationMin ?? 0}-${serviceIds.slice().sort().join(',')}`;
}

const SLOTS_CACHE_TTL = 10 * 1000; // 10 секунд (уменьшено для уменьшения race conditions)
const SLOTS_CACHE_MAX_SIZE = 100; // Максимальное количество записей в кэше
const DEBOUNCE_DELAY = 300; // 300ms

/**
 * Хук для загрузки свободных слотов для выбранной услуги, мастера и даты
 * Учитывает временные переводы и фильтрует слоты по времени (минимум через 30 минут)
 * Использует debounce для оптимизации частых изменений и кэширование для повторных запросов
 */
export function useSlotsLoader(params: {
    serviceIds: string[];
    staffId: string;
    dayStr: string;
    branchId: string;
    bizId: string;
    servicesFiltered: Array<{ id: string; duration_min: number }>;
    serviceStaff: Array<{ service_id: string; staff_id: string }> | null;
    temporaryTransfers: TemporaryTransfer[];
    staff: Staff[];
    t: (key: string, fallback?: string) => string;
    slotsRefreshKey?: number; // Ключ для принудительного обновления
}) {
    const {
        serviceIds,
        staffId,
        dayStr,
        branchId,
        bizId,
        servicesFiltered,
        serviceStaff,
        temporaryTransfers,
        staff,
        t,
        slotsRefreshKey = 0,
    } = params;

    const serviceId = serviceIds[0] ?? '';

    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Кэш слотов (используем useRef для сохранения между рендерами)
    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Очищаем предыдущий таймер debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Если параметры неполные, сразу очищаем состояние
        // Для 'any' мастера staffId может быть 'any', но это валидное значение
        if (serviceIds.length === 0 || !dayStr || (staffId !== 'any' && !staffId)) {
            setSlots([]);
            setError(null);
            setLoading(false);
            return;
        }

        const totalDurationMin =
            serviceIds.length > 1
                ? serviceIds.reduce((sum, id) => {
                      const s = servicesFiltered.find((x) => x.id === id);
                      return sum + (s?.duration_min ?? 0);
                  }, 0)
                : 0;

        // Формируем ключ кэша
        const cacheKey = buildSlotsCacheKey(dayStr, staffId, serviceIds, totalDurationMin || undefined);

        // Проверяем кэш (только если slotsRefreshKey не изменился, т.е. не было принудительного обновления)
        if (slotsRefreshKey === 0) {
            const cached = cacheRef.current.get(cacheKey);
            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (age < SLOTS_CACHE_TTL) {
                    logDebug('Booking', 'Using cached slots', { cacheKey, age: `${Math.round(age / 1000)}s` });
                    setSlots(cached.slots);
                    setError(null);
                    setLoading(false);
                    return;
                } else {
                    // Кэш устарел, удаляем
                    cacheRef.current.delete(cacheKey);
                    logDebug('Booking', 'Cache expired, removing', { cacheKey, age: `${Math.round(age / 1000)}s` });
                }
            }
        } else {
            // Принудительное обновление - очищаем кэш для этого ключа
            cacheRef.current.delete(cacheKey);
            logDebug('Booking', 'Force refresh, clearing cache', { cacheKey });
        }

        // Debounce: откладываем выполнение запроса
        debounceTimerRef.current = setTimeout(() => {
            let ignore = false;
            const isComplex = serviceIds.length > 1;
            const effectiveTotalDuration = isComplex
                ? serviceIds.reduce((sum, id) => sum + (servicesFiltered.find((x) => x.id === id)?.duration_min ?? 0), 0)
                : 0;

            (async () => {
                if (serviceIds.length === 0 || !dayStr || (staffId !== 'any' && !staffId)) {
                    setSlots([]);
                    setError(null);
                    setLoading(false);
                    return;
                }

            // Проверка: все выбранные услуги должны быть в servicesFiltered (мастер их выполняет)
            if (staffId !== 'any' && serviceStaff !== null) {
                const invalidIds = serviceIds.filter((id) => !servicesFiltered.some((s) => s.id === id));
                if (invalidIds.length > 0) {
                    logDebug('Booking', 'Slots loading: not all services in servicesFiltered, skipping RPC call', {
                        serviceIds,
                        invalidIds,
                        staffId,
                    });
                    setSlots([]);
                    setError(t('booking.step4.masterNoService', 'Выбранный мастер не выполняет эту услугу'));
                    setLoading(false);
                    return;
                }
                logDebug('Booking', 'Slots loading: services valid, proceeding with RPC call', {
                    serviceIds,
                    staffId,
                    isComplex,
                });
            } else if (staffId === 'any') {
                logDebug('Booking', 'Slots loading: any master selected', { serviceIds, isComplex });
            }

            setLoading(true);
            setError(null);

            try {
                const { isTemporaryTransfer, targetBranchId, homeBranchId } = resolveScheduleContext({
                    staffId,
                    dayStr,
                    selectedBranchId: branchId,
                    temporaryTransfers,
                    staff,
                });

                if (isTemporaryTransfer && dayStr && targetBranchId) {
                    logDebug('Booking', 'Temporary transfer detected (schedule context)', {
                        staffId,
                        date: dayStr,
                        tempBranch: targetBranchId,
                        homeBranch: homeBranchId,
                        selectedBranch: branchId,
                    });
                }

                if (isTemporaryTransfer && dayStr && targetBranchId) {
                    const { data: scheduleRule, error: scheduleError } = await supabase
                        .from('staff_schedule_rules')
                        .select('id, intervals, branch_id, is_active')
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('kind', 'date')
                        .eq('date_on', dayStr)
                        .eq('branch_id', targetBranchId)
                        .eq('is_active', true)
                        .maybeSingle();

                    logDebug('Booking', 'Checking schedule for temporary transfer', {
                        staffId,
                        date: dayStr,
                        tempBranch: targetBranchId,
                        hasSchedule: !!scheduleRule,
                        scheduleError: scheduleError?.message,
                    });

                    if (scheduleError) {
                        logWarn('Booking', 'Error checking schedule', scheduleError);
                    }

                    if (!scheduleRule || !scheduleRule.intervals || (Array.isArray(scheduleRule.intervals) && scheduleRule.intervals.length === 0)) {
                        logWarn('Booking', 'No schedule found for temporary transfer. Master may not have working hours set for this date in temporary branch.');
                    }
                }

                const { measurePerformance } = await import('@/lib/performance');
                let rpcResult: { data: ScheduleSlot[] | null; error: { message: string; code?: string } | null };

                if (isComplex && effectiveTotalDuration > 0) {
                    logDebug('Booking', 'Calling get_free_slots_complex_day_v1', {
                        bizId,
                        dayStr,
                        totalDurationMin: effectiveTotalDuration,
                        staffId: staffId === 'any' ? null : staffId,
                        // ВАЖНО: не передаём branch_id в RPC, чтобы не "пережимать" выборку.
                        // Эффективный филиал/временные переводы учитываются resolve_staff_day внутри RPC,
                        // а финальная фильтрация по выбранному branchId выполняется на фронте через filterSlotsByContext
                        // (как и для get_free_slots_service_day_v2).
                        branchId: null,
                    });
                    rpcResult = await measurePerformance(
                        'get_free_slots_complex_day_v1',
                        async () => {
                            return await supabase.rpc('get_free_slots_complex_day_v1', {
                                p_biz_id: bizId,
                                p_branch_id: null,
                                p_staff_id: staffId === 'any' ? null : staffId,
                                p_day: dayStr,
                                p_duration_min: effectiveTotalDuration,
                                p_step_min: 15,
                                p_per_staff: 400,
                            });
                        },
                        { bizId, dayStr, staffId, totalDurationMin: effectiveTotalDuration }
                    );
                } else {
                    logDebug('Booking', 'Calling get_free_slots_service_day_v2', {
                        biz_id: bizId,
                        service_id: serviceId,
                        day: dayStr,
                        targetBranchId,
                        homeBranchId,
                        isTemporaryTransfer,
                    });
                    rpcResult = await measurePerformance(
                        'get_free_slots_service_day_v2',
                        async () => {
                            return await supabase.rpc('get_free_slots_service_day_v2', {
                                p_biz_id: bizId,
                                p_service_id: serviceId,
                                p_day: dayStr,
                                p_per_staff: 400,
                                p_step_min: 15,
                            });
                        },
                        { bizId, serviceId, dayStr, staffId }
                    );
                }

                const { data, error: rpcError } = rpcResult;

                if (ignore) return;

                if (rpcError) {
                    logWarn('Booking', isComplex ? 'get_free_slots_complex_day_v1 error' : 'get_free_slots_service_day_v2 error', rpcError);
                    setSlots([]);

                    // Определяем тип ошибки для более детального сообщения
                    const errorMessage = rpcError.message || '';
                    let userMessage = t('booking.error.loadSlots', 'Не удалось загрузить свободные слоты. Попробуйте выбрать другой день или мастера.');

                    if (errorMessage.includes('not assigned') || errorMessage.includes('не прикреплён')) {
                        userMessage = t('booking.error.masterNotAssigned', 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.');
                    } else if (errorMessage.includes('conflict') || errorMessage.includes('конфликт')) {
                        userMessage = t('booking.error.scheduleConflict', 'Есть конфликт в расписании мастера на выбранный день. Выберите другой день или мастера.');
                    } else if (errorMessage.includes('schedule') || errorMessage.includes('расписание')) {
                        userMessage = t('booking.error.noSchedule', 'У выбранного мастера нет расписания на выбранный день. Выберите другой день.');
                    } else if (rpcError.code === 'PGRST301' || rpcError.code === 'PGRST116') {
                        userMessage = t('booking.error.technical', 'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.');
                    }

                    setError(userMessage);
                    return;
                }

                const all = (data ?? []) as ScheduleSlot[];
                const now = new Date();
                const minTime = new Date(now.getTime() + 30 * 60 * 1000); // минимум через 30 минут от текущего времени

                logDebug('Booking', 'RPC returned slots', {
                    total: all.length,
                    slots: all.map((s) => ({ staff_id: s.staff_id, branch_id: s.branch_id, start_at: s.start_at })),
                    isTemporaryTransfer,
                    targetBranchId,
                    homeBranchId,
                });

                // Фильтруем слоты по мастеру, времени и филиалу с учётом временных переводов
                const filtered = filterSlotsByContext(all, {
                    staffId,
                    branchId,
                    targetBranchId,
                    isTemporaryTransfer,
                    minStart: minTime,
                });

                // Сортируем слоты по времени (от ближайшего к дальнему)
                filtered.sort((a, b) => {
                    const timeA = new Date(a.start_at).getTime();
                    const timeB = new Date(b.start_at).getTime();
                    return timeA - timeB;
                });

                logDebug('Booking', 'Filtered slots result', { total: all.length, filtered: filtered.length });

                if (filtered.length === 0 && all.length > 0) {
                    logWarn('Booking', 'No slots after filtering for temporary transfer. RPC may not be accounting for temporary transfers.');
                }

                if (all.length === 0 && isTemporaryTransfer) {
                    logWarn('Booking', 'RPC returned 0 slots for temporary transfer. This likely means RPC does not account for temporary transfers.');
                }

                // Сохраняем в кэш
                const cacheKey = buildSlotsCacheKey(dayStr, staffId, serviceIds, isComplex ? effectiveTotalDuration : undefined);
                
                // Ограничиваем размер кэша: если превышен лимит, удаляем самые старые записи
                if (cacheRef.current.size >= SLOTS_CACHE_MAX_SIZE) {
                    const entries = Array.from(cacheRef.current.entries())
                        .sort((a, b) => a[1].timestamp - b[1].timestamp);
                    const toDelete = entries.slice(0, cacheRef.current.size - SLOTS_CACHE_MAX_SIZE + 1);
                    toDelete.forEach(([key]) => cacheRef.current.delete(key));
                    logDebug('Booking', 'Cache size limit reached, removed oldest entries', { removed: toDelete.length });
                }
                
                cacheRef.current.set(cacheKey, {
                    slots: filtered,
                    timestamp: Date.now(),
                });
                logDebug('Booking', 'Slots cached', { cacheKey, count: filtered.length, cacheSize: cacheRef.current.size });

                setSlots(filtered);
                setError(null);
            } catch (err) {
                if (!ignore) {
                    logWarn('Booking', 'Unexpected error loading slots', err);
                    setError(t('booking.error.technical', 'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.'));
                    setSlots([]);
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
            })();
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [serviceIds, staffId, dayStr, branchId, bizId, servicesFiltered, serviceStaff, temporaryTransfers, staff, t, slotsRefreshKey]);

    // Очистка устаревших записей кэша при размонтировании или периодически
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            for (const [key, entry] of cacheRef.current.entries()) {
                if (now - entry.timestamp > SLOTS_CACHE_TTL) {
                    cacheRef.current.delete(key);
                    cleaned++;
                }
            }
            // Дополнительная проверка: если кэш все еще превышает лимит, удаляем самые старые записи
            if (cacheRef.current.size > SLOTS_CACHE_MAX_SIZE) {
                const entries = Array.from(cacheRef.current.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toDelete = entries.slice(0, cacheRef.current.size - SLOTS_CACHE_MAX_SIZE);
                toDelete.forEach(([key]) => cacheRef.current.delete(key));
                cleaned += toDelete.length;
            }
            if (cleaned > 0) {
                logDebug('Booking', 'Cleaned expired cache entries', { cleaned, remaining: cacheRef.current.size });
            }
        }, 60000); // Проверяем каждую минуту

        return () => {
            clearInterval(cleanupInterval);
        };
    }, []);

    return { slots, loading, error };
}

