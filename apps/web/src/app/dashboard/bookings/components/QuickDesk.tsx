'use client';

import { filterServicesForStaff, resolveScheduleContext } from '@core-domain/schedule';
import { addDays } from 'date-fns';
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
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { logDebug } from '@/lib/log';
import { formatDateInTz, todayStringInTz } from '@/lib/time';

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
    const [date, setDate] = useState<string>(() => todayStringInTz(timezone));

    const temporaryTransfers = useTemporaryTransfers(bizId, date, staff);
    const serviceToStaffMap = useServiceStaffMap(staff);

    const staffForSchedule = useMemo(() => staff.map((member) => ({ id: member.id, branch_id: member.branch_id })), [staff]);

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
            const svc = servicesByBranch.find((service) => service.id === serviceId);
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
        showError: (message) => toast.showError(message),
    });

    const canCreate = branchId && serviceId && staffId && slotsApi.slotStartISO && client.canSubmitClient;
    const today = todayStringInTz(timezone);
    const tomorrow = formatDateInTz(addDays(new Date(), 1), timezone);

    return (
        <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-md)] sm:p-5 lg:p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="space-y-4">
                    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="type-label text-[var(--text-secondary)]">{t('bookings.desk.mode', 'Режим стойки')}</p>
                                <h2 className="type-section-title mt-1 text-[var(--text-primary)]">
                                    {t('bookings.desk.title', 'Быстрая запись')}
                                </h2>
                                <p className="type-body mt-2 text-[var(--text-muted)]">
                                    {t(
                                        'bookings.desk.description',
                                        'Используйте этот режим, когда клиент уже перед администратором и нужна максимально быстрая запись без длинного маршрута по разделам.',
                                    )}
                                </p>
                            </div>
                            <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                                QuickDesk
                            </span>
                        </div>
                    </div>

                    <StatusPanel title={t('bookings.desk.statusPanel.title', 'Статус на сегодня/завтра')} loading={statusStats.loading}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <StatusItem
                                label={t('bookings.desk.statusPanel.today', 'Сегодня')}
                                value={`${statusStats.todayCount} ${t('bookings.desk.statusPanel.bookings', 'записей')}`}
                                subtitle={
                                    slotsApi.slots.length > 0 && date === today
                                        ? `${slotsApi.slots.length} ${t('bookings.desk.statusPanel.freeSlots', 'свободных слотов')}`
                                        : undefined
                                }
                            />
                            <StatusItem
                                label={t('bookings.desk.statusPanel.tomorrow', 'Завтра')}
                                value={`${statusStats.tomorrowCount} ${t('bookings.desk.statusPanel.bookings', 'записей')}`}
                                subtitle={
                                    slotsApi.slots.length > 0 && date === tomorrow
                                        ? `${slotsApi.slots.length} ${t('bookings.desk.statusPanel.freeSlots', 'свободных слотов')}`
                                        : undefined
                                }
                            />
                        </div>
                    </StatusPanel>

                    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="type-label text-[var(--text-secondary)]">
                                    {t('bookings.desk.primaryAction', 'Основное действие')}
                                </p>
                                <p className="type-body mt-1 text-[var(--text-muted)]">
                                    {t(
                                        'bookings.desk.primaryActionDesc',
                                        'Как только выбраны параметры и клиент, создавайте запись отсюда. Это главный action bar для стойки.',
                                    )}
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={quickBooking.create}
                                disabled={!canCreate || quickBooking.creating}
                                isLoading={quickBooking.creating}
                            >
                                {quickBooking.creating ? t('bookings.desk.creating', 'Создание...') : t('bookings.desk.create', 'Создать запись')}
                            </Button>
                        </div>

                        {onTabChange ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    onClick={() => onTabChange('calendar')}
                                    variant="outline"
                                    size="sm"
                                >
                                    {t('bookings.desk.statusPanel.goToCalendar', 'Календарь')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onTabChange('list')}
                                    variant="outline"
                                    size="sm"
                                >
                                    {t('bookings.desk.statusPanel.goToList', 'Список')}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-4">
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
                </div>
            </div>
        </section>
    );
}
