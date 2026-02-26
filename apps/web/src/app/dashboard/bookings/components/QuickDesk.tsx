'use client';

import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { notify } from '../notify';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { StatusPanel, StatusItem } from '@/components/dashboard';
import { useToast } from '@/hooks/useToast';
import { createInternalBooking, getFreeSlotsForServiceDay, DashboardSlot } from '@/lib/bookingDashboardService';
import { trackFunnelEvent, getSessionId } from '@/lib/funnelEvents';
import { logDebug, logError, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { validateName, validatePhone } from '@/lib/validation';


type TabKey = 'calendar' | 'list' | 'desk';

type ServiceRow = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    branch_id: string;
};

type StaffRow = { id: string; full_name: string; branch_id: string };

type BranchRow = { id: string; name: string };

type QuickDeskProps = {
    timezone: string;
    bizId: string;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    onTabChange?: (tab: TabKey) => void;
};

export function QuickDesk({
    timezone,
    bizId,
    services,
    staff,
    branches: _branches,
    onTabChange,
}: QuickDeskProps) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [branchId, _setBranchId] = useState<string>('');

    const [serviceId, setServiceId] = useState<string>('');
    const [staffId, setStaffId] = useState<string>('');
    const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd'));

    const [temporaryTransfers, setTemporaryTransfers] = useState<
        Array<{ staff_id: string; branch_id: string; date: string }>
    >([]);

    useEffect(() => {
        if (!date || !bizId || staff.length === 0) {
            setTemporaryTransfers([]);
            return;
        }
        let ignore = false;
        (async () => {
            const staffHomeBranches = new Map<string, string>();
            for (const s of staff) {
                staffHomeBranches.set(s.id, s.branch_id);
            }
            const staffIds = Array.from(staffHomeBranches.keys());
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .select('staff_id, branch_id, date_on')
                .eq('biz_id', bizId)
                .in('staff_id', staffIds)
                .eq('kind', 'date')
                .eq('is_active', true)
                .eq('date_on', date);
            if (ignore) return;
            if (error) {
                logError('QuickDesk', 'Error loading temporary transfers', error);
                setTemporaryTransfers([]);
                return;
            }
            const transfers = (data ?? [])
                .filter((rule: { staff_id: string; branch_id: string; date_on: string }) => {
                    const homeBranchId = staffHomeBranches.get(rule.staff_id);
                    return homeBranchId && rule.branch_id !== homeBranchId;
                })
                .map((rule: { staff_id: string; branch_id: string; date_on: string }) => ({
                    staff_id: rule.staff_id,
                    branch_id: rule.branch_id,
                    date: rule.date_on,
                }));
            setTemporaryTransfers(transfers);
        })();
        return () => {
            ignore = true;
        };
    }, [date, bizId, staff]);

    const [serviceStaff, setServiceStaff] = useState<Array<{ service_id: string; staff_id: string; is_active: boolean }> | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            const staffIds = staff.map((s) => s.id);
            if (staffIds.length === 0) {
                setServiceStaff([]);
                return;
            }
            const { data, error } = await supabase
                .from('service_staff')
                .select('service_id,staff_id,is_active')
                .eq('is_active', true)
                .in('staff_id', staffIds);
            if (ignore) return;
            if (error) {
                logWarn('QuickDesk', 'service_staff read error', error);
                setServiceStaff(null);
            } else {
                setServiceStaff((data ?? []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [staff]);

    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)!.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    const servicesByBranch = useMemo(() => {
        if (!branchId || !date || !staffId) return [];
        const tempTransfer = temporaryTransfers.find(
            (t: { staff_id: string; branch_id: string; date: string }) => t.staff_id === staffId && t.date === date,
        );
        const targetBranchId = tempTransfer ? tempTransfer.branch_id : branchId;

        let filteredServices = services.filter((s) => s.branch_id === targetBranchId);
        if (serviceToStaffMap) {
            const servicesForStaff = new Set<string>();
            for (const [serviceId, staffSet] of serviceToStaffMap.entries()) {
                if (staffSet.has(staffId)) {
                    servicesForStaff.add(serviceId);
                }
            }
            if (tempTransfer) {
                filteredServices = filteredServices.filter((s) => {
                    if (servicesForStaff.has(s.id)) {
                        return true;
                    }
                    const hasSimilarServiceLink = services.some(
                        (svc) =>
                            svc.name_ru === s.name_ru &&
                            svc.duration_min === s.duration_min &&
                            svc.id !== s.id &&
                            servicesForStaff.has(svc.id),
                    );
                    return hasSimilarServiceLink;
                });
            } else {
                filteredServices = filteredServices.filter((s) => servicesForStaff.has(s.id));
            }
        }
        return filteredServices;
    }, [services, branchId, staffId, date, temporaryTransfers, serviceToStaffMap]);

    useEffect(() => {
        if (!staffId || !date || !serviceId) return;
        const isServiceValid = servicesByBranch.some((s) => s.id === serviceId);
        if (!isServiceValid) {
            logDebug('QuickDesk', 'Service is not valid for current staff/date, clearing serviceId', {
                serviceId,
                staffId,
                date,
                servicesByBranch: servicesByBranch.map((s) => s.id),
            });
            setServiceId('');
        }
    }, [staffId, date, servicesByBranch, serviceId]);

    const [slots, setSlots] = useState<DashboardSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');
    const [_slotsLoading, setSlotsLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const [statusStats] = useState<{
        todayCount: number;
        tomorrowCount: number;
        todayFreeSlots: number;
        tomorrowFreeSlots: number;
        loading: boolean;
    }>({
        todayCount: 0,
        tomorrowCount: 0,
        todayFreeSlots: 0,
        tomorrowFreeSlots: 0,
        loading: true,
    });

    type ClientMode = 'none' | 'existing' | 'new';
    const [clientMode, setClientMode] = useState<ClientMode>('none');

    const [searchQ, setSearchQ] = useState('');
    const [_searchLoading, setSearchLoading] = useState(false);
    const [_searchErr, setSearchErr] = useState<string | null>(null);
    const [_foundUsers, setFoundUsers] = useState<
        { id: string; full_name: string; email: string | null; phone: string | null }[]
    >([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    async function searchUsers(q: string) {
        setSearchLoading(true);
        setSearchErr(null);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ q }),
            });
            const j = await res.json();
            if (!j.ok) throw new Error(j.error || 'SEARCH_FAILED');
            setFoundUsers(j.items ?? []);
        } catch (e: unknown) {
            setSearchErr(e instanceof Error ? e.message : String(e));
            setFoundUsers([]);
        } finally {
            setSearchLoading(false);
        }
    }

    useEffect(() => {
        setDate(formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd'));
        setServiceId('');
        setStaffId('');
        setSlots([]);
        setSlotStartISO('');
    }, [branchId, timezone]);

    useEffect(() => {
        setStaffId('');
        setServiceId('');
        setSlots([]);
        setSlotStartISO('');
    }, [date]);

    useEffect(() => {
        setServiceId('');
        setSlots([]);
        setSlotStartISO('');
    }, [staffId]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!branchId || !serviceId || !date) {
                setSlots([]);
                setSlotStartISO('');
                setSlotsLoading(false);
                return;
            }
            let targetBranchId = branchId;
            if (staffId && date) {
                const tempTransfer = temporaryTransfers.find(
                    (t: { staff_id: string; branch_id: string; date: string }) =>
                        t.staff_id === staffId && t.date === date,
                );
                if (tempTransfer) {
                    targetBranchId = tempTransfer.branch_id;
                    logDebug('QuickDesk', 'Temporary transfer found for slots loading', {
                        staffId,
                        date,
                        tempBranch: tempTransfer.branch_id,
                        selectedBranch: branchId,
                    });
                }
            }
            setSlotsLoading(true);
            let raw: DashboardSlot[];
            try {
                raw = await getFreeSlotsForServiceDay({
                    bizId,
                    serviceId,
                    day: date,
                    perStaff: 400,
                    stepMinutes: 15,
                });
            } catch (error: unknown) {
                if (ignore) return;
                logError('QuickDesk', 'get_free_slots_service_day_v2 error', error);
                setSlots([]);
                setSlotStartISO('');
                setSlotsLoading(false);
                return;
            }
            const now = new Date();
            const minTime = addMinutes(now, 30);

            const filtered = raw
                .filter((s) => {
                    if (staffId && targetBranchId !== branchId) {
                        return s.branch_id === targetBranchId;
                    }
                    return s.branch_id === branchId;
                })
                .filter((s) => (staffId ? s.staff_id === staffId : true))
                .filter((s) => new Date(s.start_at) > minTime);

            const uniq = Array.from(new Map(filtered.map((s) => [s.start_at, s])).values());
            setSlots(uniq);
            setSlotStartISO((prev) => (prev && uniq.some((u) => u.start_at === prev) ? prev : uniq[0]?.start_at || ''));
            setSlotsLoading(false);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, staffId, date, branchId, temporaryTransfers]);

    useEffect(() => {
        if (!searchQ.trim() || clientMode !== 'existing') {
            setFoundUsers([]);
            return;
        }
        const timer = setTimeout(() => {
            searchUsers(searchQ);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQ, clientMode]);

    useEffect(() => {
        if (clientMode !== 'new') {
            setNewClientName('');
            setNewClientPhone('');
        }
        if (clientMode !== 'existing') {
            setSearchQ('');
            setFoundUsers([]);
            setSelectedClientId('');
        }
    }, [clientMode]);

    async function quickCreate() {
        const svc = servicesByBranch.find((s) => s.id === serviceId);
        if (!svc) {
            toast.showError(t('bookings.desk.errors.selectService', 'Выбери услугу'));
            return;
        }
        if (!slotStartISO) {
            toast.showError(t('bookings.desk.errors.noSlots', 'Нет свободных слотов на выбранные параметры'));
            return;
        }
        if (!staffId) {
            toast.showError(t('bookings.desk.errors.selectMaster', 'Выбери мастера'));
            return;
        }
        let targetBranchId = branchId;
        if (date) {
            const tempTransfer = temporaryTransfers.find(
                (t: { staff_id: string; branch_id: string; date: string }) =>
                    t.staff_id === staffId && t.date === date,
            );
            if (tempTransfer) {
                targetBranchId = tempTransfer.branch_id;
                logDebug('QuickDesk', 'Creating booking with temporary branch', {
                    staffId,
                    date,
                    tempBranch: tempTransfer.branch_id,
                    selectedBranch: branchId,
                });
            }
        }
        let p_client_id: string | null = null;
        let p_client_name: string | null = null;
        let p_client_phone: string | null = null;
        if (clientMode === 'existing') {
            if (!selectedClientId) {
                toast.showError(t('bookings.desk.errors.selectClient', 'Выбери клиента из поиска'));
                return;
            }
            p_client_id = selectedClientId;
        } else if (clientMode === 'new') {
            const name = newClientName.trim();
            const phone = newClientPhone.trim();
            const nameValidation = validateName(name, true);
            if (!nameValidation.valid) {
                toast.showError(
                    nameValidation.error || t('bookings.desk.errors.nameRequired', 'Введите имя клиента'),
                );
                return;
            }
            const phoneValidation = validatePhone(phone, true);
            if (!phoneValidation.valid) {
                toast.showError(
                    phoneValidation.error ||
                        t('bookings.desk.errors.phoneRequired', 'Введите корректный номер телефона'),
                );
                return;
            }
            p_client_name = name;
            p_client_phone = phone;
        }
        setCreating(true);
        let bookingId: string;
        try {
            bookingId = await createInternalBooking({
                bizId,
                branchId: targetBranchId,
                serviceId,
                staffId,
                startAtISO: slotStartISO,
                minutes: svc.duration_min,
                clientId: p_client_id,
                clientName: p_client_name,
                clientPhone: p_client_phone,
            });
            trackFunnelEvent({
                event_type: 'booking_success',
                source: 'quickdesk',
                biz_id: bizId,
                branch_id: targetBranchId,
                service_id: serviceId,
                staff_id: staffId,
                slot_start_at: slotStartISO,
                booking_id: bookingId,
                session_id: getSessionId(),
            });
            await notify('confirm', bookingId);
            toast.showSuccess(
                `${t('bookings.desk.created', 'Создана запись')} #${bookingId.slice(0, 8)}`,
            );
            setServiceId('');
            setStaffId('');
            setSlotStartISO('');
            setSlots([]);
            setClientMode('none');
            setSelectedClientId('');
            setSearchQ('');
            setFoundUsers([]);
            setNewClientName('');
            setNewClientPhone('');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast.showError(message);
            return;
        } finally {
            setCreating(false);
        }
    }

    const canCreate =
        branchId &&
        serviceId &&
        staffId &&
        slotStartISO &&
        (clientMode === 'none' ||
            (clientMode === 'existing' && selectedClientId) ||
            (clientMode === 'new' && newClientName.trim() && newClientPhone.trim()));

    const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    const tomorrow = formatInTimeZone(addDays(new Date(), 1), timezone, 'yyyy-MM-dd');

    return (
        <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4 sm:space-y-6">
            <StatusPanel
                title={t('bookings.desk.statusPanel.title', 'Статус на сегодня/завтра')}
                loading={statusStats.loading}
            >
                <div className="grid grid-cols-2 gap-4">
                    <StatusItem
                        label={t('bookings.desk.statusPanel.today', 'Сегодня')}
                        value={`${statusStats.todayCount} ${t(
                            'bookings.desk.statusPanel.bookings',
                            'записей',
                        )}`}
                        subtitle={
                            slots.length > 0 && date === today
                                ? `${slots.length} ${t(
                                      'bookings.desk.statusPanel.freeSlots',
                                      'свободных слотов',
                                  )}`
                                : undefined
                        }
                    />
                    <StatusItem
                        label={t('bookings.desk.statusPanel.tomorrow', 'Завтра')}
                        value={`${statusStats.tomorrowCount} ${t(
                            'bookings.desk.statusPanel.bookings',
                            'записей',
                        )}`}
                        subtitle={
                            slots.length > 0 && date === tomorrow
                                ? `${slots.length} ${t(
                                      'bookings.desk.statusPanel.freeSlots',
                                      'свободных слотов',
                                  )}`
                                : undefined
                        }
                    />
                </div>
            </StatusPanel>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                        </svg>
                        <span className="hidden sm:inline">
                            {t('bookings.desk.title', 'Быстрая запись (стойка)')}
                        </span>
                        <span className="sm:hidden">{t('bookings.desk.title', 'Стойка')}</span>
                    </h2>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all duration-200 bg-gradient-to-r from-indigo-600 to-pink-600 ${
                            !canCreate || creating
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:from-indigo-700 hover:to-pink-700 hover:shadow-lg'
                        }`}
                        onClick={quickCreate}
                        disabled={!canCreate || creating}
                    >
                        {creating ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                {t('bookings.desk.creating', 'Создание...')}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                    />
                                </svg>
                                {t('bookings.desk.create', 'Создать запись')}
                            </>
                        )}
                    </button>

                    {onTabChange && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onTabChange('calendar')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {t('bookings.desk.statusPanel.goToCalendar', 'Календарь')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onTabChange('list')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 bg_WHITE dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {t('bookings.desk.statusPanel.goToList', 'Список')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Остальной JSX (параметры записи, слоты и блок клиента) оставлен неизменным при переносе */}
            {/* ... */}
        </section>
    );
}

