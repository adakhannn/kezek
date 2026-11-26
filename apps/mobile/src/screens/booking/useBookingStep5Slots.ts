import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { addMinutes } from 'date-fns';
import { filterSlotsByContext, resolveScheduleContext } from '@core-domain/schedule';

import { useLanguage, type MobileI18nKey } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { Slot } from '@shared-client/types';
import { ANY_STAFF, temporaryTransfersOf } from './bookingSelection';
import { useBookingWorkLocations } from './useBookingWorkLocations';

const NETWORK_ERROR_RE = /network request failed|failed to fetch|network/i;
/** get_free_slots_page_v1 answers at most 100 slots a page. */
const PAGE_LIMIT = 100;

type TimeSlot = Slot & {
    start_at: string;
    end_at: string;
    staff_id: string;
    branch_id: string;
};

type SlotsErrorKind =
    | 'MASTER_NOT_ASSIGNED'
    | 'NO_SCHEDULE'
    | 'SCHEDULE_CONFLICT'
    | 'TECHNICAL'
    | 'UNKNOWN';

type SlotsResult =
    | { ok: true; slots: TimeSlot[] }
    | { ok: false; error: { kind: SlotsErrorKind; messageKey: MobileI18nKey } };

/** The keyset cursor of get_free_slots_page_v1 (web useSlotsLoader). */
type Cursor = { v: 1; scope: string; staff_id: string; start_at: string | null };
type Page = { slots: TimeSlot[]; nextCursor: Cursor | null };

type BookingDataShape = {
    business?: { id?: string | null; tz?: string | null } | null;
    serviceId?: string | null;
    serviceIds?: string[];
    services?: { id: string; duration_min: number }[];
    staff?: { id: string; branch_id: string }[];
    selectedDate?: string | null;
    staffId?: string | null;
    branchId?: string | null;
};

function mapSlotsError(error: unknown): Extract<SlotsResult, { ok: false }> {
    const err = error as { message?: string; code?: string };
    const raw = err.message || '';

    let kind: SlotsErrorKind = 'UNKNOWN';
    let messageKey: MobileI18nKey = 'booking.slots.error.unknown';

    // The database answers in Russian or English; these words match its text, not the UI.
    if (raw.includes('not assigned') || raw.includes('не прикреплён')) {
        kind = 'MASTER_NOT_ASSIGNED';
        messageKey = 'booking.slots.error.masterNotAssigned';
    } else if (raw.includes('schedule') || raw.includes('расписание')) {
        kind = 'NO_SCHEDULE';
        messageKey = 'booking.slots.error.noSchedule';
    } else if (raw.includes('conflict') || raw.includes('конфликт')) {
        kind = 'SCHEDULE_CONFLICT';
        messageKey = 'booking.slots.error.scheduleConflict';
    } else if (err.code === 'PGRST301' || err.code === 'PGRST116') {
        kind = 'TECHNICAL';
        messageKey = 'booking.slots.error.technical';
    }

    return { ok: false, error: { kind, messageKey } };
}

function isNetworkFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
    return NETWORK_ERROR_RE.test(message);
}

/** Validates a get_free_slots_page_v1 answer like the website does (parsePage). */
export function parseSlotsPage(value: unknown): Page {
    const page = value as { slots?: unknown; next_cursor?: unknown } | null;
    if (!page || !Array.isArray(page.slots) || page.slots.length > PAGE_LIMIT || !('next_cursor' in page)) {
        throw new Error('INVALID_SLOTS_PAGE');
    }
    const cursor = page.next_cursor as Cursor | null;
    if (
        cursor !== null &&
        (!cursor ||
            cursor.v !== 1 ||
            typeof cursor.scope !== 'string' ||
            typeof cursor.staff_id !== 'string' ||
            (cursor.start_at !== null && typeof cursor.start_at !== 'string'))
    ) {
        throw new Error('INVALID_SLOTS_CURSOR');
    }
    const slots = page.slots as TimeSlot[];
    if (
        slots.some(
            (slot) =>
                !slot ||
                typeof slot.staff_id !== 'string' ||
                typeof slot.branch_id !== 'string' ||
                !Number.isFinite(Date.parse(slot.start_at)) ||
                !Number.isFinite(Date.parse(slot.end_at)),
        )
    ) {
        throw new Error('INVALID_SLOTS_PAGE');
    }
    return { slots, nextCursor: cursor };
}

/**
 * Free times of the chosen day, as the website loads them (useSlotsLoader): one service of a
 * master — get_free_slots_service_day_v2; several services of a master — get_free_slots_complex_day_v1
 * with the total duration (C3); "any master" — get_free_slots_page_v1 in pages, with p_service_ids
 * for several services so only masters performing every one of them are offered (C4).
 * Slots are kept for the selected branch only: a master visiting it that day has slots there, a
 * master working at another branch that day has none (C5, `worksElsewhere`).
 */
export function useBookingStep5Slots(bookingData: BookingDataShape) {
    const { isOffline } = useNetworkStatus();
    const { t } = useLanguage();
    const [hasNetworkError, setHasNetworkError] = useState(false);

    const bizId = bookingData.business?.id ?? null;
    const branchId = bookingData.branchId ?? null;
    const day = bookingData.selectedDate ?? null;
    const staffId = bookingData.staffId ?? null;
    const serviceIds = bookingData.serviceIds ?? (bookingData.serviceId ? [bookingData.serviceId] : []);
    const serviceIdsKey = [...serviceIds].sort().join(',');
    const isComplex = serviceIds.length > 1;
    const duration = isComplex
        ? serviceIds.reduce(
              (sum, id) => sum + (bookingData.services?.find((service) => service.id === id)?.duration_min ?? 0),
              0,
          )
        : 0;
    const isAny = staffId === ANY_STAFF;
    const hasInputs = !!bizId && !!branchId && !!day && !!staffId && serviceIds.length > 0 && (!isComplex || duration > 0);

    const masterQuery = useQuery<SlotsResult>({
        queryKey: ['slots', bizId, serviceIdsKey, duration, day, staffId, branchId],
        queryFn: async () => {
            try {
                const { data, error } = isComplex
                    ? await supabase.rpc('get_free_slots_complex_day_v1', {
                          p_biz_id: bizId,
                          p_branch_id: null,
                          p_staff_id: staffId,
                          p_day: day,
                          p_duration_min: duration,
                          p_step_min: 15,
                          p_per_staff: 400,
                      })
                    : await supabase.rpc('get_free_slots_service_day_v2', {
                          p_biz_id: bizId,
                          p_service_id: serviceIds[0],
                          p_staff_id: staffId,
                          p_day: day,
                          p_per_staff: 400,
                          p_step_min: 15,
                      });

                if (error) {
                    throw error;
                }

                return { ok: true, slots: (data || []) as TimeSlot[] };
            } catch (error: unknown) {
                if (isNetworkFailure(error)) {
                    throw error;
                }

                return mapSlotsError(error);
            }
        },
        enabled: hasInputs && !isAny,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    const anyQuery = useInfiniteQuery({
        queryKey: ['slots', 'any', bizId, serviceIdsKey, duration, day, branchId],
        initialPageParam: null as Cursor | null,
        queryFn: async ({ pageParam }): Promise<Page> => {
            const { data, error } = await supabase.rpc('get_free_slots_page_v1', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_day: day,
                p_service_id: isComplex ? null : serviceIds[0],
                p_duration_min: isComplex ? duration : null,
                p_staff_id: null,
                p_cursor: pageParam,
                p_limit: PAGE_LIMIT,
                // R25-11: only masters who perform every selected service.
                p_service_ids: isComplex ? serviceIdsKey.split(',') : null,
            });
            if (error) throw error;
            const page = parseSlotsPage(data);
            if (page.nextCursor && pageParam && JSON.stringify(page.nextCursor) === JSON.stringify(pageParam)) {
                throw new Error('SLOTS_CURSOR_DID_NOT_ADVANCE');
            }
            return page;
        },
        getNextPageParam: (last: Page) => last.nextCursor ?? undefined,
        enabled: hasInputs && isAny,
        staleTime: 0,
    });

    const locationsQuery = useBookingWorkLocations(hasInputs && !isAny ? bizId : null, bookingData.business?.tz);

    const rawSlots = useMemo<TimeSlot[]>(() => {
        if (isAny) {
            const merged = new Map<string, TimeSlot>();
            for (const page of anyQuery.data?.pages ?? []) {
                for (const slot of page.slots) merged.set(`${slot.staff_id}:${slot.start_at}`, slot);
            }
            return [...merged.values()];
        }
        return masterQuery.data && masterQuery.data.ok ? masterQuery.data.slots : [];
    }, [isAny, anyQuery.data, masterQuery.data]);

    const slots = useMemo(() => {
        if (!hasInputs || !branchId || !staffId) return [];
        return filterSlotsByContext(rawSlots, {
            staffId,
            branchId,
            targetBranchId: branchId,
            isTemporaryTransfer: false,
            minStart: addMinutes(new Date(), 30),
        }).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)) as TimeSlot[];
    }, [rawSlots, hasInputs, branchId, staffId]);

    const worksElsewhere = useMemo(() => {
        if (isAny || !staffId || !day || !branchId || !locationsQuery.data) return false;
        const staff = bookingData.staff ?? [];
        const context = resolveScheduleContext({
            staffId,
            dayStr: day,
            selectedBranchId: branchId,
            temporaryTransfers: temporaryTransfersOf(locationsQuery.data, staff),
            staff,
        });
        return context.isTemporaryTransfer && context.targetBranchId !== branchId;
    }, [isAny, staffId, day, branchId, locationsQuery.data, bookingData.staff]);

    const activeError = isAny ? anyQuery.error : masterQuery.error;
    const anyFirstPageFailed = isAny && !!anyQuery.error && !anyQuery.data;

    useEffect(() => {
        if (!activeError) {
            setHasNetworkError(false);
            return;
        }
        if (isNetworkFailure(activeError)) {
            setHasNetworkError(true);
        }
    }, [activeError]);

    let domainErrorMessage: string | null = null;
    if (!isAny && masterQuery.data && !masterQuery.data.ok) {
        domainErrorMessage = t(masterQuery.data.error.messageKey);
    } else if (anyFirstPageFailed && !isNetworkFailure(anyQuery.error)) {
        domainErrorMessage = t(mapSlotsError(anyQuery.error).error.messageKey);
    }

    return {
        slots,
        domainErrorMessage,
        isLoading: isAny ? anyQuery.isLoading : masterQuery.isLoading,
        refetch: () => (isAny ? anyQuery.refetch() : masterQuery.refetch()),
        showOfflineBanner: isOffline || hasNetworkError,
        /** "Any master": more masters and times are on the next page. */
        hasMore: isAny && !!anyQuery.hasNextPage,
        loadMore: () => {
            if (isAny && anyQuery.hasNextPage && !anyQuery.isFetchingNextPage) void anyQuery.fetchNextPage();
        },
        loadingMore: isAny && anyQuery.isFetchingNextPage,
        loadMoreFailed: isAny && anyQuery.isFetchNextPageError,
        /** The chosen master works at another branch on this day (C5). */
        worksElsewhere,
    };
}
