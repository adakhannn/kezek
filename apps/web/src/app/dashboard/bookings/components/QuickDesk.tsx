'use client';


import { filterServicesForStaff, resolveScheduleContext } from '@core-domain/schedule';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useMemo, useState } from 'react';


import { QuickDeskClientSection } from './QuickDeskClientSection';
import { useQuickBooking } from './useQuickBooking';
import { useQuickDeskClient } from './useQuickDeskClient';
import { useQuickDeskFormResets } from './useQuickDeskFormResets';
import { useQuickDeskSlots } from './useQuickDeskSlots';
import { useServiceStaffMap } from './useServiceStaffMap';
import { useSyncServiceId } from './useSyncServiceId';
import { useTemporaryTransfers } from './useTemporaryTransfers';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { StatusPanel, StatusItem } from '@/components/dashboard';
import { useToast } from '@/hooks/useToast';
import { logDebug } from '@/lib/log';


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

    const temporaryTransfers = useTemporaryTransfers(bizId, date, staff);
    const serviceToStaffMap = useServiceStaffMap(staff);

    const staffForSchedule = useMemo(
        () => staff.map((s) => ({ id: s.id, branch_id: s.branch_id })),
        [staff],
    );

    const scheduleContext = useMemo(
        () =>
            branchId && date
                ? resolveScheduleContext({
                      staffId: staffId || '',
                      dayStr: date,
                      selectedBranchId: branchId,
                      temporaryTransfers,
                      staff: staffForSchedule,
                  })
                : null,
        [branchId, date, staffId, temporaryTransfers, staffForSchedule],
    );

    const servicesByBranch = useMemo(() => {
        if (!branchId || !date || !staffId || !scheduleContext) return [];
        return filterServicesForStaff({
            services,
            targetBranchId: scheduleContext.targetBranchId,
            staffId,
            serviceToStaffMap,
            isTemporaryTransfer: scheduleContext.isTemporaryTransfer,
        });
    }, [services, branchId, staffId, date, scheduleContext, serviceToStaffMap]);

    const slotsApi = useQuickDeskSlots({
        bizId,
        branchId,
        staffId,
        serviceId,
        date,
        scheduleContext,
    });

    useSyncServiceId(serviceId, setServiceId, staffId, date, servicesByBranch);
    useQuickDeskFormResets({
        branchId,
        timezone,
        date,
        staffId,
        setDate,
        setServiceId,
        setStaffId,
        clearSlots: slotsApi.clearSlots,
    });

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

    const client = useQuickDeskClient();

    const quickBooking = useQuickBooking({
        getParams: () => {
            const svc = servicesByBranch.find((s) => s.id === serviceId);
            if (!svc) {
                return { ok: false, error: t('bookings.desk.errors.selectService', 'Выбери услугу') };
            }
            if (!slotsApi.slotStartISO) {
                return {
                    ok: false,
                    error: t('bookings.desk.errors.noSlots', 'Нет свободных слотов на выбранные параметры'),
                };
            }
            if (!staffId) {
                return { ok: false, error: t('bookings.desk.errors.selectMaster', 'Выбери мастера') };
            }
            const createCtx =
                branchId && date
                    ? resolveScheduleContext({
                          staffId,
                          dayStr: date,
                          selectedBranchId: branchId,
                          temporaryTransfers,
                          staff: staffForSchedule,
                      })
                    : null;
            const targetBranchId = createCtx?.targetBranchId ?? branchId;
            if (createCtx?.isTemporaryTransfer) {
                logDebug('QuickDesk', 'Creating booking with temporary branch', {
                    staffId,
                    date,
                    targetBranchId,
                    selectedBranch: branchId,
                });
            }
            const clientResult = client.getClientPayload(t);
            if (!clientResult.ok) {
                return { ok: false, error: clientResult.error };
            }
            const { clientId, clientName, clientPhone } = clientResult.payload;
            return {
                ok: true,
                payload: {
                    bizId,
                    branchId: targetBranchId,
                    serviceId,
                    staffId,
                    startAtISO: slotsApi.slotStartISO,
                    minutes: svc.duration_min,
                    clientId,
                    clientName,
                    clientPhone,
                },
            };
        },
        onSuccess: (bookingId) => {
            toast.showSuccess(`${t('bookings.desk.created', 'Создана запись')} #${bookingId.slice(0, 8)}`);
            setServiceId('');
            setStaffId('');
            slotsApi.clearSlots();
            client.reset();
        },
        showError: (msg) => toast.showError(msg),
    });

    const canCreate =
        branchId &&
        serviceId &&
        staffId &&
        slotsApi.slotStartISO &&
        client.canSubmitClient;

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
                            slotsApi.slots.length > 0 && date === today
                                ? `${slotsApi.slots.length} ${t(
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
                            slotsApi.slots.length > 0 && date === tomorrow
                                ? `${slotsApi.slots.length} ${t(
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
                            !canCreate || quickBooking.creating
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:from-indigo-700 hover:to-pink-700 hover:shadow-lg'
                        }`}
                        onClick={quickBooking.create}
                        disabled={!canCreate || quickBooking.creating}
                    >
                        {quickBooking.creating ? (
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
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {t('bookings.desk.statusPanel.goToList', 'Список')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <QuickDeskClientSection
                clientMode={client.clientMode}
                setClientMode={client.setClientMode}
                searchQ={client.searchQ}
                setSearchQ={client.setSearchQ}
                foundUsers={client.foundUsers}
                selectedClientId={client.selectedClientId}
                setSelectedClientId={client.setSelectedClientId}
                newClientName={client.newClientName}
                setNewClientName={client.setNewClientName}
                newClientPhone={client.newClientPhone}
                setNewClientPhone={client.setNewClientPhone}
                searchLoading={client.searchLoading}
                searchErr={client.searchErr}
                t={t}
            />
        </section>
    );
}

