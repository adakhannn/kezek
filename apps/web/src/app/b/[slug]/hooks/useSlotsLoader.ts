import { useEffect, useRef, useState } from 'react';

import { resolveScheduleContext, type Slot as ScheduleSlot } from '@core-domain/schedule';

import { logDebug, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

import { buildSlotsCacheKey, filterAndSortVisibleSlots, mapSlotsRpcErrorToMessage } from './slotsLoaderHelpers';

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type Staff = {
    id: string;
    branch_id: string;
};

type CacheEntry = {
    slots: ScheduleSlot[];
    timestamp: number;
};

const SLOTS_CACHE_TTL = 10 * 1000;
const SLOTS_CACHE_MAX_SIZE = 100;
const DEBOUNCE_DELAY = 300;

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
    slotsRefreshKey?: number;
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

    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (!serviceId || !dayStr || (staffId !== 'any' && !staffId)) {
            setSlots([]);
            setError(null);
            setLoading(false);
            return;
        }

        const cacheKey = buildSlotsCacheKey(dayStr, staffId, serviceId);

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
                }

                cacheRef.current.delete(cacheKey);
                logDebug('Booking', 'Cache expired, removing', { cacheKey, age: `${Math.round(age / 1000)}s` });
            }
        } else {
            cacheRef.current.delete(cacheKey);
            logDebug('Booking', 'Force refresh, clearing cache', { cacheKey });
        }

        debounceTimerRef.current = setTimeout(() => {
            let ignore = false;

            (async () => {
                if (!serviceId || !staffId || !dayStr) {
                    setSlots([]);
                    setError(null);
                    setLoading(false);
                    return;
                }

                if (staffId !== 'any' && serviceStaff !== null) {
                    const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
                    if (!isServiceValid) {
                        logDebug('Booking', 'Slots loading: service not in servicesFiltered, skipping RPC call', {
                            serviceId,
                            staffId,
                            servicesFiltered: servicesFiltered.map((s) => s.id),
                        });
                        setSlots([]);
                        setError(t('booking.step4.masterNoService', 'Выбранный мастер не выполняет эту услугу'));
                        setLoading(false);
                        return;
                    }

                    logDebug('Booking', 'Slots loading: service is valid (in servicesFiltered), proceeding with RPC call', {
                        serviceId,
                        staffId,
                    });
                } else if (staffId === 'any') {
                    logDebug('Booking', 'Slots loading: any master selected, showing slots from all masters', {
                        serviceId,
                    });
                } else {
                    logDebug('Booking', 'Slots loading: serviceStaff not loaded yet, proceeding with RPC call (will check validity)', {
                        serviceId,
                        staffId,
                        serviceStaffLoaded: false,
                    });
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

                        if (
                            !scheduleRule ||
                            !scheduleRule.intervals ||
                            (Array.isArray(scheduleRule.intervals) && scheduleRule.intervals.length === 0)
                        ) {
                            logWarn(
                                'Booking',
                                'No schedule found for temporary transfer. Master may not have working hours set for this date in temporary branch.',
                            );
                        }
                    }

                    logDebug('Booking', 'Calling RPC with params', {
                        biz_id: bizId,
                        service_id: serviceId,
                        day: dayStr,
                        targetBranchId,
                        homeBranchId,
                        isTemporaryTransfer,
                    });

                    const { measurePerformance } = await import('@/lib/performance');
                    const rpcResult = await measurePerformance(
                        'get_free_slots_service_day_v2',
                        async () =>
                            await supabase.rpc('get_free_slots_service_day_v2', {
                                p_biz_id: bizId,
                                p_service_id: serviceId,
                                p_day: dayStr,
                                p_per_staff: 400,
                                p_step_min: 15,
                            }),
                        { bizId, serviceId, dayStr, staffId },
                    );
                    const { data, error: rpcError } = rpcResult;

                    if (ignore) return;

                    if (rpcError) {
                        logWarn('Booking', 'get_free_slots_service_day_v2 error', rpcError);
                        setSlots([]);
                        setError(
                            mapSlotsRpcErrorToMessage({
                                rpcMessage: rpcError.message,
                                rpcCode: rpcError.code,
                                t,
                            }),
                        );
                        return;
                    }

                    const all = (data ?? []) as ScheduleSlot[];
                    const now = new Date();
                    const minTime = new Date(now.getTime() + 30 * 60 * 1000);

                    logDebug('Booking', 'RPC returned slots', {
                        total: all.length,
                        slots: all.map((s) => ({ staff_id: s.staff_id, branch_id: s.branch_id, start_at: s.start_at })),
                        isTemporaryTransfer,
                        targetBranchId,
                        homeBranchId,
                    });

                    const filtered = filterAndSortVisibleSlots({
                        slots: all,
                        staffId,
                        branchId,
                        targetBranchId,
                        isTemporaryTransfer,
                        minStart: minTime,
                    });

                    logDebug('Booking', 'Filtered slots result', { total: all.length, filtered: filtered.length });

                    if (filtered.length === 0 && all.length > 0) {
                        logWarn('Booking', 'No slots after filtering for temporary transfer. RPC may not be accounting for temporary transfers.');
                    }

                    if (all.length === 0 && isTemporaryTransfer) {
                        logWarn('Booking', 'RPC returned 0 slots for temporary transfer. This likely means RPC does not account for temporary transfers.');
                    }

                    const resultCacheKey = buildSlotsCacheKey(dayStr, staffId, serviceId);

                    if (cacheRef.current.size >= SLOTS_CACHE_MAX_SIZE) {
                        const entries = Array.from(cacheRef.current.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
                        const toDelete = entries.slice(0, cacheRef.current.size - SLOTS_CACHE_MAX_SIZE + 1);
                        toDelete.forEach(([key]) => cacheRef.current.delete(key));
                        logDebug('Booking', 'Cache size limit reached, removed oldest entries', { removed: toDelete.length });
                    }

                    cacheRef.current.set(resultCacheKey, {
                        slots: filtered,
                        timestamp: Date.now(),
                    });
                    logDebug('Booking', 'Slots cached', {
                        cacheKey: resultCacheKey,
                        count: filtered.length,
                        cacheSize: cacheRef.current.size,
                    });

                    setSlots(filtered);
                    setError(null);
                } catch (err) {
                    if (!ignore) {
                        logWarn('Booking', 'Unexpected error loading slots', err);
                        setError(
                            t(
                                'booking.error.technical',
                                'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.',
                            ),
                        );
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

            if (cacheRef.current.size > SLOTS_CACHE_MAX_SIZE) {
                const entries = Array.from(cacheRef.current.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toDelete = entries.slice(0, cacheRef.current.size - SLOTS_CACHE_MAX_SIZE);
                toDelete.forEach(([key]) => cacheRef.current.delete(key));
                cleaned += toDelete.length;
            }

            if (cleaned > 0) {
                logDebug('Booking', 'Cleaned expired cache entries', { cleaned, remaining: cacheRef.current.size });
            }
        }, 60000);

        return () => {
            clearInterval(cleanupInterval);
        };
    }, []);

    return { slots, loading, error };
}
