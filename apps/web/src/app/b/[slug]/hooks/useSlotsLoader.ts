import { addMinutes } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type Staff = {
    id: string;
    branch_id: string;
};

const isDev = process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
    if (isDev) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
};
const debugWarn = (...args: unknown[]) => {
    if (isDev) {
         
        console.warn(...args);
    }
};

/**
 * Кэш для хранения загруженных слотов
 * Ключ: `${dayStr}-${staffId}-${serviceId}`
 */
type CacheEntry = {
    slots: Slot[];
    timestamp: number;
};

const SLOTS_CACHE_TTL = 10 * 1000; // 10 секунд (уменьшено для уменьшения race conditions)
const DEBOUNCE_DELAY = 300; // 300ms

/**
 * Хук для загрузки свободных слотов для выбранной услуги, мастера и даты
 * Учитывает временные переводы и фильтрует слоты по времени (минимум через 30 минут)
 * Использует debounce для оптимизации частых изменений и кэширование для повторных запросов
 */
export function useSlotsLoader(params: {
    serviceId: string;
    staffId: string;
    dayStr: string;
    branchId: string;
    bizId: string;
    servicesFiltered: Array<{ id: string }>;
    serviceStaff: Array<{ service_id: string; staff_id: string }> | null;
    temporaryTransfers: TemporaryTransfer[];
    staff: Staff[];
    t: (key: string, fallback?: string) => string;
    slotsRefreshKey?: number; // Ключ для принудительного обновления
}) {
    const {
        serviceId,
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

    const [slots, setSlots] = useState<Slot[]>([]);
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
        if (!serviceId || !dayStr || (staffId !== 'any' && !staffId)) {
            setSlots([]);
            setError(null);
            setLoading(false);
            return;
        }

        // Формируем ключ кэша
        const cacheKey = `${dayStr}-${staffId}-${serviceId}`;

        // Проверяем кэш (только если slotsRefreshKey не изменился, т.е. не было принудительного обновления)
        if (slotsRefreshKey === 0) {
            const cached = cacheRef.current.get(cacheKey);
            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (age < SLOTS_CACHE_TTL) {
                    debugLog('[Booking] Using cached slots:', { cacheKey, age: `${Math.round(age / 1000)}s` });
                    setSlots(cached.slots);
                    setError(null);
                    setLoading(false);
                    return;
                } else {
                    // Кэш устарел, удаляем
                    cacheRef.current.delete(cacheKey);
                    debugLog('[Booking] Cache expired, removing:', { cacheKey, age: `${Math.round(age / 1000)}s` });
                }
            }
        } else {
            // Принудительное обновление - очищаем кэш для этого ключа
            cacheRef.current.delete(cacheKey);
            debugLog('[Booking] Force refresh, clearing cache:', { cacheKey });
        }

        // Debounce: откладываем выполнение запроса
        debounceTimerRef.current = setTimeout(() => {
            let ignore = false;

            (async () => {
                if (!serviceId || !staffId || !dayStr) {
                    setSlots([]);
                    setError(null);
                    setLoading(false);
                    return;
                }

            // Проверка: если услуга не в servicesFiltered, значит мастер не выполняет её
            // Для "любого мастера" пропускаем эту проверку, так как показываем слоты от всех мастеров
            if (staffId !== 'any' && serviceStaff !== null) {
                const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
                if (!isServiceValid) {
                    debugLog('[Booking] Slots loading: service not in servicesFiltered, skipping RPC call', {
                        serviceId,
                        staffId,
                        servicesFiltered: servicesFiltered.map((s) => s.id),
                    });
                    setSlots([]);
                    setError(t('booking.step4.masterNoService', 'Выбранный мастер не выполняет эту услугу'));
                    setLoading(false);
                    return;
                }
                debugLog('[Booking] Slots loading: service is valid (in servicesFiltered), proceeding with RPC call', {
                    serviceId,
                    staffId,
                });
            } else {
                if (staffId === 'any') {
                    debugLog('[Booking] Slots loading: any master selected, showing slots from all masters', {
                        serviceId,
                    });
                } else {
                    debugLog('[Booking] Slots loading: serviceStaff not loaded yet, proceeding with RPC call (will check validity)', {
                        serviceId,
                        staffId,
                        serviceStaffLoaded: false,
                    });
                }
            }

            setLoading(true);
            setError(null);

            try {
                // Определяем, является ли мастер временно переведенным
                const isTemporaryTransfer = dayStr && temporaryTransfers.some(
                    (t) => t.staff_id === staffId && t.date === dayStr
                );

                // Для временно переведенного мастера нужно получить слоты для временного филиала
                let targetBranchId = branchId;
                const staffCurrent = staff.find((m) => m.id === staffId);
                const homeBranchId = staffCurrent?.branch_id;

                if (isTemporaryTransfer && dayStr) {
                    const tempTransfer = temporaryTransfers.find(
                        (t) => t.staff_id === staffId && t.date === dayStr
                    );
                    if (tempTransfer) {
                        targetBranchId = tempTransfer.branch_id;
                        debugLog('[Booking] Temporary transfer found:', {
                            staffId,
                            date: dayStr,
                            tempBranch: tempTransfer.branch_id,
                            homeBranch: homeBranchId,
                            selectedBranch: branchId,
                        });
                    }
                }

                // Проверяем, есть ли у мастера расписание на эту дату во временном филиале
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

                    debugLog('[Booking] Checking schedule for temporary transfer:', {
                        staffId,
                        date: dayStr,
                        tempBranch: targetBranchId,
                        hasSchedule: !!scheduleRule,
                        scheduleError: scheduleError?.message,
                    });

                    if (scheduleError) {
                        debugWarn('[Booking] Error checking schedule:', scheduleError);
                    }

                    if (!scheduleRule || !scheduleRule.intervals || (Array.isArray(scheduleRule.intervals) && scheduleRule.intervals.length === 0)) {
                        debugWarn('[Booking] No schedule found for temporary transfer. Master may not have working hours set for this date in temporary branch.');
                    }
                }

                // Вызываем RPC для получения слотов
                debugLog('[Booking] Calling RPC with params:', {
                    biz_id: bizId,
                    service_id: serviceId,
                    day: dayStr,
                    targetBranchId,
                    homeBranchId,
                    isTemporaryTransfer,
                });

                // Мониторинг производительности загрузки слотов
                const { measurePerformance } = await import('@/lib/performance');
                const rpcResult = await measurePerformance(
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
                const { data, error: rpcError } = rpcResult;

                if (ignore) return;

                if (rpcError) {
                    debugWarn('[get_free_slots_service_day_v2] error:', rpcError);
                    setSlots([]);

                    // Определяем тип ошибки для более детального сообщения
                    const errorMessage = rpcError.message || '';
                    let userMessage = t('booking.error.loadSlots', 'Не удалось загрузить свободные слоты. Попробуйте выбрать другой день или мастера.');

                    if (errorMessage.includes('not assigned') || errorMessage.includes('не прикреплён')) {
                        userMessage = t('booking.error.masterNotAssigned', 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.');
                    } else if (errorMessage.includes('schedule') || errorMessage.includes('расписание')) {
                        userMessage = t('booking.error.noSchedule', 'У выбранного мастера нет расписания на выбранный день. Выберите другой день.');
                    } else if (errorMessage.includes('conflict') || errorMessage.includes('конфликт')) {
                        userMessage = t('booking.error.scheduleConflict', 'Есть конфликт в расписании мастера на выбранный день. Выберите другой день или мастера.');
                    } else if (rpcError.code === 'PGRST301' || rpcError.code === 'PGRST116') {
                        userMessage = t('booking.error.technical', 'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.');
                    }

                    setError(userMessage);
                    return;
                }

                const all = (data ?? []) as Slot[];
                const now = new Date();
                const minTime = addMinutes(now, 30); // минимум через 30 минут от текущего времени

                debugLog('[Booking] RPC returned slots:', {
                    total: all.length,
                    slots: all.map((s) => ({ staff_id: s.staff_id, branch_id: s.branch_id, start_at: s.start_at })),
                    isTemporaryTransfer,
                    targetBranchId,
                    homeBranchId,
                });

                // Фильтруем слоты по мастеру (если не выбран "любой мастер"), времени и филиалу
                const filtered = all.filter((s) => {
                    // Если выбран конкретный мастер, фильтруем по нему
                    if (staffId !== 'any' && s.staff_id !== staffId) {
                        debugLog('[Booking] Slot filtered (wrong staff):', { slot_staff: s.staff_id, selected_staff: staffId });
                        return false;
                    }
                    if (new Date(s.start_at) <= minTime) {
                        debugLog('[Booking] Slot filtered (too early):', { start_at: s.start_at, minTime: minTime.toISOString() });
                        return false;
                    }

                    // Для временно переведенного мастера принимаем слоты только из филиала временного перевода
                    if (isTemporaryTransfer && targetBranchId) {
                        const matchesBranch = s.branch_id === targetBranchId;
                        if (!matchesBranch) {
                            debugLog('[Booking] Slot filtered (wrong branch for temporary transfer):', {
                                slot_branch: s.branch_id,
                                expected_branch: targetBranchId,
                            });
                            return false;
                        }
                        debugLog('[Booking] Slot accepted (temporary transfer):', { slot_branch: s.branch_id, start_at: s.start_at });
                        return true;
                    }

                    // Для обычного мастера принимаем слоты из выбранного филиала
                    if (s.branch_id !== branchId) {
                        debugLog('[Booking] Slot filtered (wrong branch):', { slot_branch: s.branch_id, selected_branch: branchId });
                        return false;
                    }

                    return true;
                });

                // Сортируем слоты по времени (от ближайшего к дальнему)
                filtered.sort((a, b) => {
                    const timeA = new Date(a.start_at).getTime();
                    const timeB = new Date(b.start_at).getTime();
                    return timeA - timeB;
                });

                debugLog('[Booking] Filtered slots result:', { total: all.length, filtered: filtered.length });

                if (filtered.length === 0 && all.length > 0) {
                    debugWarn('[Booking] No slots after filtering for temporary transfer. RPC may not be accounting for temporary transfers.');
                }

                if (all.length === 0 && isTemporaryTransfer) {
                    debugWarn('[Booking] RPC returned 0 slots for temporary transfer. This likely means RPC does not account for temporary transfers.');
                }

                // Сохраняем в кэш
                const cacheKey = `${dayStr}-${staffId}-${serviceId}`;
                cacheRef.current.set(cacheKey, {
                    slots: filtered,
                    timestamp: Date.now(),
                });
                debugLog('[Booking] Slots cached:', { cacheKey, count: filtered.length });

                setSlots(filtered);
                setError(null);
            } catch (err) {
                if (!ignore) {
                    debugWarn('[Booking] Unexpected error loading slots:', err);
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
    }, [serviceId, staffId, dayStr, branchId, bizId, servicesFiltered, serviceStaff, temporaryTransfers, staff, t, slotsRefreshKey]);

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
            if (cleaned > 0) {
                debugLog('[Booking] Cleaned expired cache entries:', { cleaned });
            }
        }, 60000); // Проверяем каждую минуту

        return () => {
            clearInterval(cleanupInterval);
        };
    }, []);

    return { slots, loading, error };
}

