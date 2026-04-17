import { useEffect, useState } from 'react';

import { FilterPreset, applyPreset } from './FilterPresets';
import type { BookingItem } from './bookingsViewTypes';

import { cancelBookingWithFallback, confirmBooking } from '@/lib/bookingDashboardService';
import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

const ITEMS_PER_PAGE = 30;

function useDashboardBookingsFilters(initialTotal: number) {
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(initialTotal);
    const [activePreset, setActivePreset] = useState<FilterPreset>(null);

    return {
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setTotalCount,
        setActivePreset,
    };
}

type UseDashboardBookingsListControllerOptions = {
    bizId: string;
    initial: BookingItem[];
    timezone: string;
    locale: string;
    t: (key: string, fallback?: string) => string;
    notify: (kind: 'confirm' | 'cancel', id: string) => Promise<void>;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
};

export function useDashboardBookingsListController({
    bizId,
    initial,
    timezone,
    locale,
    t,
    notify,
    showError,
    showSuccess,
}: UseDashboardBookingsListControllerOptions) {
    const [list, setList] = useState<BookingItem[]>(initial);
    const {
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setTotalCount,
        setActivePreset,
    } = useDashboardBookingsFilters(initial.length);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
    const [hasStaffAccess, setHasStaffAccess] = useState<boolean>(false);

    useEffect(() => {
        async function fetchCurrentStaff() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) return;

                const { data: staff } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();

                if (staff) {
                    setCurrentStaffId(staff.id);
                    setHasStaffAccess(true);
                }
            } catch (error) {
                logWarn('useDashboardBookingsListController', 'Failed to fetch current staff', error);
            }
        }

        void fetchCurrentStaff();
    }, []);

    async function refresh() {
        setIsLoading(true);
        try {
            let query = supabase
                .from('bookings')
                .select(
                    `
                    id,
                    status,
                    start_at,
                    end_at,
                    branch_id,
                    staff_id,
                    services (name_ru, name_ky, name_en),
                    staff (full_name),
                    client_name,
                    client_phone,
                    booking_services (
                        duration_min,
                        service:services (name_ru, name_ky, name_en)
                    )
                `,
                    { count: 'exact' },
                )
                .eq('biz_id', bizId);

            if (activePreset) {
                const presetFilters = applyPreset(activePreset, timezone, currentStaffId);

                if (presetFilters.dateFilter) {
                    query = query.gte('start_at', presetFilters.dateFilter.gte);
                    query = query.lte('start_at', presetFilters.dateFilter.lte);
                }

                if (presetFilters.staffFilter) {
                    query = query.eq('staff_id', presetFilters.staffFilter);
                }

                if (presetFilters.statusFilter === 'holdConfirmed') {
                    query = query.in('status', ['hold', 'confirmed']);
                }
            }

            if (statusFilter !== 'all' && !activePreset) {
                if (statusFilter === 'active') {
                    query = query.in('status', ['confirmed']);
                } else {
                    query = query.eq('status', statusFilter);
                }
            } else if (!activePreset) {
                query = query.neq('status', 'cancelled');
            }

            if (branchFilter !== 'all') {
                query = query.eq('branch_id', branchFilter);
            }

            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            type ListBookingRow = {
                id: string | number;
                status: BookingItem['status'];
                start_at: string | Date;
                end_at: string | Date;
                branch_id: string | null;
                staff_id: string | null;
                services?: { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null;
                staff?: { full_name: string }[] | null;
                client_name?: string | null;
                client_phone?: string | null;
                booking_services?: {
                    duration_min: number | null;
                    service?: { name_ru?: string; name_ky?: string | null; name_en?: string | null } | null;
                }[] | null;
            };

            const { data, count } = await query.order('start_at', { ascending: false }).range(from, to);
            setTotalCount(count ?? 0);

            const rawRows = (data ?? []) as ListBookingRow[];
            const mapped: BookingItem[] = rawRows.map((row) => {
                const base: BookingItem = {
                    id: String(row.id),
                    status: row.status as BookingItem['status'],
                    start_at: String(row.start_at),
                    end_at: String(row.end_at),
                    branch_id: row.branch_id,
                    staff_id: row.staff_id,
                    services: row.services as BookingItem['services'],
                    staff: row.staff as BookingItem['staff'],
                    client_name: row.client_name ?? undefined,
                    client_phone: row.client_phone ?? undefined,
                };

                const rawServices = Array.isArray(row.booking_services) ? row.booking_services : [];
                if (rawServices.length > 0) {
                    const parts: string[] = [];
                    let totalDuration = 0;

                    for (const bookingService of rawServices) {
                        const service = bookingService.service || {};
                        const name =
                            (locale === 'ky' && service.name_ky) ||
                            (locale === 'en' && service.name_en) ||
                            service.name_ru ||
                            '';
                        const duration = typeof bookingService.duration_min === 'number' ? bookingService.duration_min : 0;
                        totalDuration += duration;
                        const label = name
                            ? `${name} (${duration} ${t('booking.duration.min', 'мин')})`
                            : `${duration} ${t('booking.duration.min', 'мин')}`;
                        parts.push(label);
                    }

                    const summaryBase = parts.join('; ');
                    const summaryTotal =
                        totalDuration > 0
                            ? ` — ${t('cabinet.bookings.card.totalDuration', 'Всего:')} ${totalDuration} ${t('booking.duration.min', 'мин')}`
                            : '';

                    base.servicesSummary = `${summaryBase}${summaryTotal}`;
                }

                return base;
            });

            let filtered = mapped;
            if (searchQuery.trim()) {
                const queryText = searchQuery.toLowerCase().trim();
                filtered = filtered.filter((booking) => {
                    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                    const master = Array.isArray(booking.staff) ? booking.staff[0] : booking.staff;
                    return (
                        service?.name_ru?.toLowerCase().includes(queryText) ||
                        master?.full_name?.toLowerCase().includes(queryText) ||
                        booking.client_name?.toLowerCase().includes(queryText) ||
                        booking.client_phone?.includes(queryText) ||
                        String(booking.id).toLowerCase().includes(queryText)
                    );
                });
            }

            setList(filtered);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, branchFilter, activePreset]);

    useEffect(() => {
        void refresh();
    }, [statusFilter, branchFilter, currentPage, bizId, activePreset]);

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
            await cancelBookingWithFallback(id);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
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

    return {
        list,
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        isLoading,
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
