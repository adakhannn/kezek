'use client';

import { formatInTimeZone } from 'date-fns-tz';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { DashboardSlot } from '@/lib/bookingDashboardService';

type Props = {
    branches: { id: string; name: string }[];
    staff: { id: string; full_name: string }[];
    services: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    branchId: string; date: string; staffId: string; serviceId: string; slotStartISO: string;
    today: string; tomorrow: string; timezone: string; locale: string;
    slots: DashboardSlot[]; slotsLoading: boolean; disabled: boolean;
    /** FE-08: failed loads are errors with a retry, never "no masters", "no services" or "no free slots". */
    slotsError?: boolean; onRetrySlots?: () => void;
    staffError?: boolean; onRetryStaff?: () => void;
    servicesError?: boolean; onRetryServices?: () => void;
    setBranchId: (value: string) => void; setDate: (value: string) => void;
    setStaffId: (value: string) => void; setServiceId: (value: string) => void;
    setSlotStartISO: (value: string) => void;
    t: (key: string, fallback?: string) => string;
};

/** Selection surface only: scheduling and booking commands stay in existing hooks/domain. */
export function QuickDeskBookingFields(props: Props) {
    const { branches, staff, services, branchId, date, staffId, serviceId, slotStartISO,
        today, tomorrow, timezone, locale, slots, slotsLoading, disabled, t,
        slotsError = false, staffError = false, servicesError = false } = props;
    const ready = !!(branchId && date && staffId && serviceId);
    return (
        <div className="space-y-4 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
            <Select label={t('bookings.desk.branch', 'Филиал')} value={branchId}
                onChange={event => props.setBranchId(event.target.value)} disabled={disabled}>
                <option value="">{t('bookings.desk.selectBranch', 'Выбери филиал')}</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
            <Input type="date" label={t('bookings.desk.date', 'Дата')} min={today} value={date}
                onChange={event => props.setDate(event.target.value)} disabled={disabled} />
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => props.setDate(today)}>
                    {t('bookings.desk.today', 'Сегодня')}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => props.setDate(tomorrow)}>
                    {t('bookings.desk.tomorrow', 'Завтра')}
                </Button>
            </div>
            <Select label={t('bookings.desk.master', 'Мастер')} value={staffId}
                onChange={event => props.setStaffId(event.target.value)} disabled={disabled || !branchId || staffError}>
                <option value="">{t(branchId && !staff.length && !staffError ? 'bookings.desk.noMasters' : 'bookings.desk.selectMaster', 'Выбери мастера')}</option>
                {staff.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
            </Select>
            {staffError ? (
                <LoadFailedNotice title={t('bookings.desk.transfersLoadError', 'Не удалось загрузить переводы мастеров между филиалами')}
                    onRetry={props.onRetryStaff} />
            ) : null}
            <Select label={t('bookings.desk.service', 'Услуга')} value={serviceId}
                onChange={event => props.setServiceId(event.target.value)} disabled={disabled || !staffId || servicesError}>
                <option value="">{t(staffId && !services.length && !servicesError ? 'bookings.desk.noServices' : 'bookings.desk.selectService', 'Выбери услугу')}</option>
                {services.map(service => <option key={service.id} value={service.id}>
                    {(locale === 'ky' ? service.name_ky : locale === 'en' ? service.name_en : service.name_ru) || service.name_ru}
                    {' · '}{service.duration_min} {t('staff.cabinet.services.duration', 'мин')}
                </option>)}
            </Select>
            {servicesError ? (
                <LoadFailedNotice title={t('bookings.desk.servicesLoadError', 'Не удалось загрузить услуги мастеров')}
                    onRetry={props.onRetryServices} />
            ) : null}
            <Select label={t('bookings.desk.time', 'Время')} value={slotStartISO}
                onChange={event => props.setSlotStartISO(event.target.value)}
                disabled={disabled || !ready || slotsLoading || !slots.length}>
                <option value="">{t('bookings.desk.time', 'Время')}</option>
                {slots.map(slot => <option key={slot.start_at} value={slot.start_at}>
                    {formatInTimeZone(slot.start_at, timezone, 'HH:mm')}–{formatInTimeZone(slot.end_at, timezone, 'HH:mm')}
                </option>)}
            </Select>
            {ready && !slotsLoading && slotsError ? (
                <LoadFailedNotice title={t('bookings.desk.slotsLoadError', 'Не удалось загрузить свободное время')}
                    onRetry={props.onRetrySlots} />
            ) : (
                <p role="status" className="type-caption text-[var(--text-muted)]">
                    {!ready ? t('bookings.desk.selectParamsFirst', 'Выбери филиал, услугу и мастера')
                        : slotsLoading ? t('bookings.desk.loadingSlots', 'Загрузка слотов...')
                            : !slots.length ? t('bookings.desk.noSlots', 'Нет свободных слотов')
                                : <>{slots.length} {t('bookings.desk.statusPanel.freeSlots', 'свободных слотов')}</>}
                </p>
            )}
        </div>
    );
}
