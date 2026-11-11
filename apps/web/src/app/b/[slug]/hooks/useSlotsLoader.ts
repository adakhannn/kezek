import { filterSlotsByContext, resolveScheduleContext, type Slot as ScheduleSlot } from '@core-domain/schedule';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { logDebug, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type TemporaryTransfer = { staff_id: string; branch_id: string; date: string };
type Staff = { id: string; branch_id: string };
type Params = {
    serviceIds: string[]; staffId: string; dayStr: string; branchId: string; bizId: string;
    servicesFiltered: Array<{ id: string; duration_min: number }>;
    serviceStaff: Array<{ service_id: string; staff_id: string }> | null;
    temporaryTransfers: TemporaryTransfer[]; staff: Staff[];
    t: (key: string, fallback?: string) => string;
    slotsRefreshKey?: number;
};
type RpcError = { message: string; code?: string };
type RequestIdentity = { key: string };
type Cursor = { v: 1; scope: string; staff_id: string; start_at: string | null };
type Page = { slots: ScheduleSlot[]; nextCursor: Cursor | null };
type Snapshot = Page & { request: RequestIdentity; error: RpcError | null; loadingMore?: boolean; moreError?: RpcError | null };
type CacheEntry = Page & { timestamp: number; refreshKey: number };
type Request = {
    bizId: string; branchId: string; staffId: string; dayStr: string; serviceId: string;
    isComplex: boolean; duration: number; targetBranchId: string; isTemporaryTransfer: boolean;
    cacheKey: string; refreshKey: number;
};
const EMPTY_SLOTS: ScheduleSlot[] = [];
const SLOTS_CACHE_TTL = 10_000;
const SLOTS_CACHE_MAX_SIZE = 100;
const DEBOUNCE_DELAY = 300;

function debounceRequest(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new Error('Slots request cancelled')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, DEBOUNCE_DELAY);
        signal.addEventListener('abort', abort, { once: true });
    });
}

/** One async availability source for both cache hits and debounced network requests. */
async function loadSlots(request: Request, cache: Map<string, CacheEntry>, signal: AbortSignal, cursor: Cursor | null = null): Promise<Page> {
    const { cacheKey, refreshKey, bizId, branchId, staffId, dayStr, serviceId, isComplex, duration, targetBranchId, isTemporaryTransfer } = request;
    const cached = cache.get(cacheKey);
    if (!cursor && cached && cached.refreshKey === refreshKey && Date.now() - cached.timestamp < SLOTS_CACHE_TTL) {
        const minStart = Date.now() + 30 * 60_000;
        return { slots: cached.slots.filter(slot => new Date(slot.start_at).getTime() >= minStart), nextCursor: cached.nextCursor };
    }
    if (!cursor) cache.delete(cacheKey);
    // Existing 300 ms network debounce: changing parameters cancels it and its eventual result.
    if (!cursor) await debounceRequest(signal);
    if (signal.aborted) return { slots: [], nextCursor: null };
    if (!cursor && isTemporaryTransfer && targetBranchId) {
        const { data: scheduleRule, error } = await supabase.from('staff_schedule_rules')
            .select('id, intervals, branch_id, is_active').eq('biz_id', bizId).eq('staff_id', staffId)
            .eq('kind', 'date').eq('date_on', dayStr).eq('branch_id', targetBranchId).eq('is_active', true).maybeSingle();
        if (signal.aborted) return { slots: [], nextCursor: null };
        if (error) logWarn('Booking', 'Error checking schedule', error);
        if (!scheduleRule || !Array.isArray(scheduleRule.intervals) || scheduleRule.intervals.length === 0) {
            logWarn('Booking', 'No schedule found for temporary transfer');
        }
    }
    const { measurePerformance } = await import('@/lib/performance');
    if (signal.aborted) return { slots: [], nextCursor: null };
    const complex = isComplex && duration > 0;
    const paged = staffId === 'any';
    const { data, error } = await measurePerformance(
        paged ? 'get_free_slots_page_v1' : complex ? 'get_free_slots_complex_day_v1' : 'get_free_slots_service_day_v2',
        async () => paged
            ? await supabase.rpc('get_free_slots_page_v1', {
                p_biz_id: bizId, p_branch_id: targetBranchId || branchId, p_day: dayStr,
                p_service_id: complex ? null : serviceId, p_duration_min: complex ? duration : null,
                p_staff_id: null, p_cursor: cursor, p_limit: 100,
            })
            : complex
            ? await supabase.rpc('get_free_slots_complex_day_v1', {
                p_biz_id: bizId, p_branch_id: null, p_staff_id: staffId === 'any' ? null : staffId,
                p_day: dayStr, p_duration_min: duration, p_step_min: 15, p_per_staff: 400,
            })
            : await supabase.rpc('get_free_slots_service_day_v2', {
                p_biz_id: bizId, p_service_id: serviceId, p_day: dayStr, p_per_staff: 400, p_step_min: 15,
                p_staff_id: staffId === 'any' ? null : staffId,
            }),
        { bizId, dayStr, staffId, serviceId },
    );
    if (signal.aborted) return { slots: [], nextCursor: null };
    if (error) throw error;
    const page = paged ? parsePage(data) : { slots: (data ?? []) as ScheduleSlot[], nextCursor: null };
    const slots = filterSlotsByContext(page.slots, {
        staffId, branchId, targetBranchId, isTemporaryTransfer, minStart: new Date(Date.now() + 30 * 60_000),
    }).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    if (!cursor && cache.size >= SLOTS_CACHE_MAX_SIZE) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (const [key] of oldest.slice(0, cache.size - SLOTS_CACHE_MAX_SIZE + 1)) cache.delete(key);
    }
    if (!cursor) cache.set(cacheKey, { slots, nextCursor: page.nextCursor, timestamp: Date.now(), refreshKey });
    logDebug('Booking', 'Slots loaded', { total: page.slots.length, filtered: slots.length, isTemporaryTransfer });
    return { slots, nextCursor: page.nextCursor };
}

function parsePage(value: unknown): Page {
    const page = value as { slots?: unknown; next_cursor?: unknown } | null;
    if (!page || !Array.isArray(page.slots) || page.slots.length > 100 || !('next_cursor' in page)) throw new Error('INVALID_SLOTS_PAGE');
    const cursor = page.next_cursor as Cursor | null;
    if (cursor !== null && (!cursor || cursor.v !== 1 || typeof cursor.scope !== 'string' || typeof cursor.staff_id !== 'string' || (cursor.start_at !== null && typeof cursor.start_at !== 'string'))) throw new Error('INVALID_SLOTS_CURSOR');
    if (page.slots.some(slot => !slot || typeof slot.staff_id !== 'string' || typeof slot.branch_id !== 'string' || !Number.isFinite(Date.parse(slot.start_at)) || !Number.isFinite(Date.parse(slot.end_at)))) throw new Error('INVALID_SLOTS_PAGE');
    return { slots: page.slots, nextCursor: cursor };
}

function describeError(error: RpcError, t: Params['t']) {
    if (error.message.includes('not assigned') || error.message.includes('не прикреплён')) return t('booking.error.masterNotAssigned', 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.');
    if (error.message.includes('conflict') || error.message.includes('конфликт')) return t('booking.error.scheduleConflict', 'Есть конфликт в расписании мастера на выбранный день. Выберите другой день или мастера.');
    if (error.message.includes('schedule') || error.message.includes('расписание')) return t('booking.error.noSchedule', 'У выбранного мастера нет расписания на выбранный день. Выберите другой день.');
    if (error.code === 'PGRST301' || error.code === 'PGRST116' || error.code === 'UNEXPECTED') return t('booking.error.technical', 'Произошла техническая ошибка. Пожалуйста, обновите страницу или попробуйте позже.');
    return t('booking.error.loadSlots', 'Не удалось загрузить свободные слоты. Попробуйте выбрать другой день или мастера.');
}

export function useSlotsLoader({ serviceIds, staffId, dayStr, branchId, bizId, servicesFiltered, serviceStaff, temporaryTransfers, staff, t, slotsRefreshKey = 0 }: Params) {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const cacheRef = useRef(new Map<string, CacheEntry>());
    const nextPageRef = useRef<AbortController | null>(null);
    const { targetBranchId, isTemporaryTransfer, homeBranchId } = resolveScheduleContext({ staffId, dayStr, selectedBranchId: branchId, temporaryTransfers, staff });
    const isComplex = serviceIds.length > 1;
    const serviceId = serviceIds[0] ?? '';
    const duration = isComplex ? serviceIds.reduce((sum, id) => sum + (servicesFiltered.find(service => service.id === id)?.duration_min ?? 0), 0) : 0;
    const invalidServices = staffId !== 'any' && serviceStaff !== null && serviceIds.some(id => !servicesFiltered.some(service => service.id === id));
    const hasInputs = Boolean(bizId && branchId && dayStr && staffId && serviceIds.length);
    const enabled = hasInputs && !invalidServices;
    const cacheKey = JSON.stringify([bizId, branchId, staffId, dayStr, serviceId, [...serviceIds].sort(), duration, targetBranchId, isTemporaryTransfer, homeBranchId]);
    const requestKey = JSON.stringify([cacheKey, slotsRefreshKey, enabled]);
    const request = useMemo(() => ({ key: requestKey }), [requestKey]);

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void loadSlots({ bizId, branchId, staffId, dayStr, serviceId, isComplex, duration, targetBranchId, isTemporaryTransfer, cacheKey, refreshKey: slotsRefreshKey }, cacheRef.current, controller.signal)
            .then(page => {
                if (!controller.signal.aborted) setSnapshot({ request, ...page, error: null });
            })
            .catch(value => {
                if (controller.signal.aborted) return;
                const error: RpcError = value && typeof value.message === 'string'
                    ? { message: value.message, code: value instanceof Error ? 'UNEXPECTED' : value.code }
                    : { message: String(value), code: 'UNEXPECTED' };
                logWarn('Booking', 'Error loading slots', error);
                setSnapshot({ request, slots: [], nextCursor: null, error });
            });
        return () => { controller.abort(); nextPageRef.current?.abort(); nextPageRef.current = null; };
    }, [bizId, branchId, staffId, dayStr, serviceId, isComplex, duration, targetBranchId, isTemporaryTransfer, cacheKey, slotsRefreshKey, request, enabled]);

    const current = enabled && snapshot?.request === request ? snapshot : null;
    const loadMore = useCallback(() => {
        if (!current?.nextCursor || current.loadingMore || nextPageRef.current) return;
        const controller = new AbortController();
        const cursor = current.nextCursor;
        nextPageRef.current = controller;
        setSnapshot(previous => previous?.request === request ? { ...previous, loadingMore: true, moreError: null } : previous);
        void loadSlots({ bizId, branchId, staffId, dayStr, serviceId, isComplex, duration, targetBranchId, isTemporaryTransfer, cacheKey, refreshKey: slotsRefreshKey }, cacheRef.current, controller.signal, cursor)
            .then(page => {
                if (controller.signal.aborted) return;
                if (page.nextCursor && JSON.stringify(page.nextCursor) === JSON.stringify(cursor)) throw new Error('SLOTS_CURSOR_DID_NOT_ADVANCE');
                const slots = [...new Map([...current.slots, ...page.slots].map(slot => [`${slot.staff_id}:${slot.start_at}`, slot])).values()]
                    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
                const cached = cacheRef.current.get(cacheKey);
                if (cached) cacheRef.current.set(cacheKey, { ...cached, slots, nextCursor: page.nextCursor });
                setSnapshot(previous => previous?.request === request && previous.nextCursor === cursor
                    ? { ...previous, slots, nextCursor: page.nextCursor, loadingMore: false, moreError: null } : previous);
            }).catch(value => {
                if (controller.signal.aborted) return;
                const error = { message: value instanceof Error ? value.message : 'SLOTS_PAGE_FAILED', code: 'UNEXPECTED' };
                setSnapshot(previous => previous?.request === request ? { ...previous, loadingMore: false, moreError: error } : previous);
            }).finally(() => { if (nextPageRef.current === controller) nextPageRef.current = null; });
    }, [current, request, bizId, branchId, staffId, dayStr, serviceId, isComplex, duration, targetBranchId, isTemporaryTransfer, cacheKey, slotsRefreshKey]);
    return {
        requestKey,
        slots: current?.slots ?? EMPTY_SLOTS,
        loading: enabled && !current,
        hasMore: Boolean(current?.nextCursor), loadingMore: current?.loadingMore ?? false, loadMore,
        moreError: current?.moreError ? describeError(current.moreError, t) : null,
        error: hasInputs && invalidServices ? t('booking.step4.masterNoService', 'Выбранный мастер не выполняет эту услугу') : current?.error ? describeError(current.error, t) : null,
    };
}
