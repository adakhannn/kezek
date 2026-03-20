'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { createInternalBooking, getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';
import { TZ } from '@/lib/time';
import { validateName, validatePhone } from '@/lib/validation';
import type { Branch, RpcSlot, Service, TranslationFn } from './staffBookingsTypes';

type Props = {
    bizId: string;
    staffId: string;
    defaultBranchId: string | null;
    services: Service[];
    branches: Branch[];
    locale: string;
    t: TranslationFn;
};

export function StaffCreateBookingForm({
    bizId,
    staffId,
    defaultBranchId,
    services,
    branches,
    locale,
    t,
}: Props) {
    const [branchId, setBranchId] = useState<string>(defaultBranchId || '');
    const [serviceId, setServiceId] = useState<string>('');
    const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const servicesByBranch = useMemo(() => {
        if (!branchId) return [];
        return services.filter((service) => service.branch_id === branchId && service.active);
    }, [services, branchId]);

    useEffect(() => {
        let ignore = false;

        (async () => {
            if (!branchId || !serviceId || !date) {
                setSlots([]);
                setSlotStartISO('');
                setSlotsLoading(false);
                return;
            }

            setSlotsLoading(true);

            try {
                const raw = await getFreeSlotsForServiceDay({
                    bizId,
                    serviceId,
                    day: date,
                    perStaff: 400,
                    stepMinutes: 15,
                });

                if (ignore) return;

                const cast = (raw || []) as RpcSlot[];
                const minTime = addMinutes(new Date(), 30);
                const filtered = cast
                    .filter((slot) => slot.branch_id === branchId)
                    .filter((slot) => slot.staff_id === staffId)
                    .filter((slot) => new Date(slot.start_at) > minTime);

                const unique = Array.from(new Map(filtered.map((slot) => [slot.start_at, slot])).values());
                setSlots(unique);
                setSlotStartISO((prev) =>
                    prev && unique.some((slot) => slot.start_at === prev) ? prev : (unique[0]?.start_at || '')
                );
            } catch (error: unknown) {
                const { logError } = require('@/lib/log');
                logError('StaffBookingsView', 'get_free_slots_service_day_v2 error', {
                    message: error instanceof Error ? error.message : String(error),
                });
                if (ignore) return;
                setSlots([]);
                setSlotStartISO('');
            } finally {
                if (!ignore) {
                    setSlotsLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [bizId, branchId, date, serviceId, staffId]);

    useEffect(() => {
        setServiceId('');
        setSlots([]);
        setSlotStartISO('');
    }, [branchId]);

    useEffect(() => {
        setSlots([]);
        setSlotStartISO('');
    }, [date]);

    function getServiceName(service: Service): string {
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        return service.name_ru;
    }

    async function createBooking() {
        const service = servicesByBranch.find((item) => item.id === serviceId);
        if (!service) {
            alert(t('staff.cabinet.bookings.create.errors.selectService', 'Выберите услугу'));
            return;
        }

        if (!slotStartISO) {
            alert(t('staff.cabinet.bookings.create.errors.noSlots', 'Нет свободных слотов'));
            return;
        }

        const nameValidation = validateName(newClientName.trim(), true);
        if (!nameValidation.valid) {
            alert(nameValidation.error || t('staff.cabinet.bookings.create.errors.nameRequired', 'Введите имя клиента'));
            return;
        }

        const phoneValidation = validatePhone(newClientPhone.trim(), true);
        if (!phoneValidation.valid) {
            alert(
                phoneValidation.error ||
                    t('staff.cabinet.bookings.create.errors.phoneRequired', 'Введите корректный номер телефона')
            );
            return;
        }

        setCreating(true);
        try {
            const bookingId = await createInternalBooking({
                bizId,
                branchId,
                serviceId,
                staffId,
                startAtISO: slotStartISO,
                minutes: service.duration_min,
                clientId: null,
                clientName: newClientName.trim(),
                clientPhone: newClientPhone.trim(),
            });

            alert(t('staff.cabinet.bookings.create.success', `Создана запись #${bookingId.slice(0, 8)}`));
            setServiceId('');
            setSlotStartISO('');
            setSlots([]);
            setNewClientName('');
            setNewClientPhone('');
            window.location.reload();
        } finally {
            setCreating(false);
        }
    }

    const canCreate = branchId && serviceId && slotStartISO && newClientName.trim() && newClientPhone.trim();

    return (
        <Card variant="elevated" className="p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('staff.cabinet.bookings.create.title', 'Создать запись')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.cabinet.bookings.create.branch', 'Филиал')}
                    </label>
                    <select
                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                    >
                        <option value="">{t('staff.cabinet.bookings.create.selectBranch', 'Выберите филиал')}</option>
                        {branches.filter((branch) => branch.is_active).map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.cabinet.bookings.create.date', 'Дата')}
                    </label>
                    <input
                        type="date"
                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={date}
                        min={formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.cabinet.bookings.create.service', 'Услуга')}
                    </label>
                    <select
                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        disabled={!branchId}
                    >
                        <option value="">{t('staff.cabinet.bookings.create.selectService', 'Выберите услугу')}</option>
                        {servicesByBranch.map((service) => (
                            <option key={service.id} value={service.id}>
                                {getServiceName(service)} ({service.duration_min}м)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {slotsLoading ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    {t('staff.cabinet.bookings.create.loadingSlots', 'Загрузка слотов...')}
                </div>
            ) : slots.length > 0 ? (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('staff.cabinet.bookings.create.time', 'Время')}
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {slots.map((slot, index) => {
                            const timeLabel = formatInTimeZone(new Date(slot.start_at), TZ, 'HH:mm');
                            const isSelected = slotStartISO === slot.start_at;
                            return (
                                <button
                                    key={`${slot.staff_id}-${slot.start_at}-${index}`}
                                    type="button"
                                    onClick={() => setSlotStartISO(slot.start_at)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                    {timeLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : branchId && serviceId && date ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    {t('staff.cabinet.bookings.create.noSlots', 'Нет свободных слотов')}
                </div>
            ) : null}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {t('staff.cabinet.bookings.create.client', 'Данные клиента')}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'staff.cabinet.bookings.create.clientDescription',
                        'Введите данные клиента, который звонит или приходит лично'
                    )}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.cabinet.bookings.create.clientName', 'Имя')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('staff.cabinet.bookings.create.clientNamePlaceholder', 'Введите имя клиента')}
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.cabinet.bookings.create.clientPhone', 'Телефон')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="+996555123456"
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('staff.cabinet.bookings.create.phoneFormat', 'Формат: +996555123456')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    className={`w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                        !canCreate || creating ? 'opacity-50 cursor-not-allowed' : 'hover:from-indigo-700 hover:to-pink-700'
                    }`}
                    onClick={() => void createBooking()}
                    disabled={!canCreate || creating}
                >
                    {creating ? (
                        <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('staff.cabinet.bookings.create.creating', 'Создание...')}
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {t('staff.cabinet.bookings.create.create', 'Создать запись')}
                        </>
                    )}
                </button>
            </div>
        </Card>
    );
}
