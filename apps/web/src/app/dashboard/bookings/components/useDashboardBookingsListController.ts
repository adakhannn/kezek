import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FilterPreset } from './FilterPresets';
import type { BookingItem } from './bookingsViewTypes';

import { useNow } from '@/hooks/useNow';
import { bookingCancellationError } from '@/lib/bookingCancellationError';
import { cancelBooking, confirmBooking } from '@/lib/bookingDashboardService';
import {
    DASHBOARD_BOOKINGS_PAGE_SIZE,
    dashboardBookingsRpcArgs,
    fetchDashboardBookingsPage,
    type DashboardBookingRow,
    type DashboardBookingsRpcArgs,
} from '@/lib/dashboardBookingsPage';
import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { dayBoundsInTz, formatDateInTz } from '@/lib/time';

const ITEMS_PER_PAGE = DASHBOARD_BOOKINGS_PAGE_SIZE;
const SEARCH_DEBOUNCE_MS = 300;

type Translate = (key: string, fallback?: string) => string;

function toBookingItem(row: DashboardBookingRow, locale: string, t: Translate): BookingItem {
    const item: BookingItem = {
        id: row.id,
        status: row.status,
        start_at: row.start_at,
        end_at: row.end_at,
        branch_id: row.branch_id,
        staff_id: row.staff_id,
        services: row.service ? [row.service] : undefined,
        staff: row.staff_name ? [{ full_name: row.staff_name }] : undefined,
        client_id: row.client_id,
        client_name: row.client_name ?? undefined,
        client_phone: row.client_phone ?? undefined,
    };

    if (row.booking_services.length > 0) {
        const minutes = t('booking.duration.min', 'мин');
        let totalDuration = 0;
        const parts = row.booking_services.map((bookingService) => {
            const service = bookingService.service;
            const name = (locale === 'ky' && service?.name_ky) || (locale === 'en' && service?.name_en) || service?.name_ru || '';
            const duration = typeof bookingService.duration_min === 'number' ? bookingService.duration_min : 0;
            totalDuration += duration;
            return name ? `${name} (${duration} ${minutes})` : `${duration} ${minutes}`;
        });
        const total = totalDuration > 0 ? ` — ${t('cabinet.bookings.card.totalDuration', 'Всего:')} ${totalDuration} ${minutes}` : '';
        item.servicesSummary = `${parts.join('; ')}${total}`;
    }

    return item;
}

type UseDashboardBookingsListControllerOptions = {
    bizId: string;
    timezone: string;
    locale: string;
    t: Translate;
    notify: (kind: 'confirm' | 'cancel', id: string) => Promise<void>;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
};

/**
 * The dashboard bookings list (FE-03). Filters, search over the whole history, the order and the
 * total of matches come from one read (public.dashboard_bookings_page); the browser no longer
 * searches the 30 loaded rows. Only the latest request may change the list, a filter change goes
 * to page 1 in the same update, typing is debounced, and a failed load is shown as such.
 */
export function useDashboardBookingsListController({
    bizId,
    timezone,
    locale,
    t,
    notify,
    showError,
    showSuccess,
}: UseDashboardBookingsListControllerOptions) {
    const [statusFilter, setStatusFilterState] = useState<string>('all');
    const [branchFilter, setBranchFilterState] = useState<string>('all');
    const [activePreset, setActivePresetState] = useState<FilterPreset>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rows, setRows] = useState<DashboardBookingRow[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [settled, setSettled] = useState<{ key: string; ok: boolean } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
    const [hasStaffAccess, setHasStaffAccess] = useState<boolean>(false);

    // The business day moves at midnight while the page stays open (FE-14).
    const today = formatDateInTz(useNow(), timezone);
    const presetStaffId = activePreset === 'myStaff' ? currentStaffId : null;
    const args = useMemo(() => dashboardBookingsRpcArgs({
        bizId,
        statusFilter,
        branchFilter,
        preset: activePreset,
        search,
        page: currentPage,
        todayBounds: activePreset === 'today' ? dayBoundsInTz(today, timezone) : null,
        currentStaffId: presetStaffId,
    }), [bizId, statusFilter, branchFilter, activePreset, search, currentPage, today, timezone, presetStaffId]);
    const argsKey = JSON.stringify(args);

    const sequence = useRef(0);
    const inFlight = useRef<AbortController | null>(null);
    const shownKey = useRef<string | null>(null);
    const latestArgs = useRef(args);
    const messages = useRef({ t, showError });
    useEffect(() => {
        latestArgs.current = args;
        messages.current = { t, showError };
    });

    const load = useCallback(async (next: DashboardBookingsRpcArgs) => {
        const id = ++sequence.current;
        inFlight.current?.abort();
        const abort = new AbortController();
        inFlight.current = abort;
        const key = JSON.stringify(next);
        try {
            const page = await fetchDashboardBookingsPage(next, abort.signal);
            if (id !== sequence.current) return;
            if (page.rows.length === 0 && next.p_offset > 0) {
                // The page is past the end (bookings were cancelled or filtered away): show the last page.
                setCurrentPage(Math.max(1, Math.ceil(page.total / ITEMS_PER_PAGE)));
                return;
            }
            shownKey.current = key;
            setRows(page.rows);
            setTotalCount(page.total);
            setSettled({ key, ok: true });
        } catch (error) {
            if (id !== sequence.current || abort.signal.aborted) return;
            logWarn('useDashboardBookingsListController', 'Bookings page failed', error);
            if (shownKey.current !== key) {
                // Never leave another selection's rows under this one.
                shownKey.current = null;
                setRows([]);
                setTotalCount(0);
            }
            setSettled({ key, ok: false });
            messages.current.showError(messages.current.t('bookings.list.loadError', 'Не удалось загрузить брони'));
        } finally {
            if (id === sequence.current) setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load(args);
    }, [load, args]);

    useEffect(() => () => {
        sequence.current += 1;
        inFlight.current?.abort();
    }, []);

    useEffect(() => {
        const next = searchQuery.trim();
        if (next === search) return undefined;
        const timer = window.setTimeout(() => {
            setSearch(next);
            setCurrentPage(1);
        }, next ? SEARCH_DEBOUNCE_MS : 0);
        return () => window.clearTimeout(timer);
    }, [searchQuery, search]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user || !active) return;
                // The staff row of this business only: a manager who is also staff elsewhere must not
                // get that business's staff id for "Мой мастер".
                const { data: staff } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('biz_id', bizId)
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();
                if (!active) return;
                setCurrentStaffId(staff?.id ?? null);
                setHasStaffAccess(Boolean(staff));
            } catch (error) {
                logWarn('useDashboardBookingsListController', 'Failed to fetch current staff', error);
            }
        })();
        return () => {
            active = false;
        };
    }, [bizId]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await load(latestArgs.current);
    }, [load]);

    function setStatusFilter(value: string) {
        setStatusFilterState(value);
        setCurrentPage(1);
    }

    function setBranchFilter(value: string) {
        setBranchFilterState(value);
        setCurrentPage(1);
    }

    function setActivePreset(value: FilterPreset) {
        setActivePresetState(value);
        setCurrentPage(1);
    }

    async function confirm(id: string) {
        try {
            await confirmBooking(id);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
            return;
        }

        await notify('confirm', id);
        await refresh();
        showSuccess(t('bookings.actions.confirmed', 'Бронь подтверждена'));
    }

    async function cancel(id: string) {
        try {
            await cancelBooking(id);
        } catch (error: unknown) {
            const message = bookingCancellationError(error)?.message
                ?? (error instanceof Error ? error.message : t('bookings.list.cancelError', 'Не удалось отменить запись'));
            showError(message);
            return;
        }

        await notify('cancel', id);
        await refresh();
        showSuccess(t('bookings.actions.cancelled', 'Бронь отменена'));
    }

    async function markAttendance(id: string, attended: boolean) {
        const response = await fetch(`/api/bookings/${id}/mark-attendance`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ attended }),
        });
        const result = await response.json();
        if (!result.ok) {
            showError(result.error || t('bookings.list.markAttendanceError', 'Не удалось обновить статус'));
            return;
        }
        await refresh();
        showSuccess(attended ? t('bookings.actions.attended', 'Клиент пришёл') : t('bookings.actions.noShow', 'Клиент не пришёл'));
    }

    const list = useMemo(() => rows.map((row) => toBookingItem(row, locale, t)), [rows, locale, t]);

    return {
        list,
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        isLoading: settled?.key !== argsKey || refreshing,
        loadFailed: settled?.key === argsKey && !settled.ok,
        currentStaffId,
        hasStaffAccess,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setActivePreset,
        refresh,
        confirm,
        cancel,
        markAttendance,
        itemsPerPage: ITEMS_PER_PAGE,
    };
}
