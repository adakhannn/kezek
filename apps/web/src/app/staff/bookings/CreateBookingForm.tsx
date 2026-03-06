'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';
import { getFreeSlotsForServiceDay, createInternalBooking } from '@/lib/bookingDashboardService';
import { TZ, todayStringInTz } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';
import { validateName, validatePhone } from '@/lib/validation';

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    active: boolean;
    branch_id: string;
};

type Branch = {
    id: string;
    name: string;
    is_active: boolean;
};

type RpcSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

type Props = {
    bizId: string;
    staffId: string;
    defaultBranchId: string | null;
    services: Service[];
    branches: Branch[];
};

export function CreateBookingForm({ bizId, staffId, defaultBranchId, services, branches }: Props) {
    const { t, locale } = useLanguage();

    const [branchId, setBranchId] = useState<string>(defaultBranchId || '');
    const [serviceId, setServiceId] = useState<string>('');
    const selectedStaffId = staffId;
    const [date, setDate] = useState<string>(() => todayStringInTz(TZ));
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const servicesByBranch = useMemo(() => {
        if (!branchId) return [];
        return services.filter((s) => s.branch_id === branchId && s.active);
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
                const now = new Date();
                const minTime = addMinutes(now, 30);

                const filtered = cast
                    .filter((s) => s.branch_id === branchId)
                    .filter((s) => s.staff_id === selectedStaffId)
                    .filter((s) => new Date(s.start_at) > minTime);

                const uniq = Array.from(new Map(filtered.map((s) => [s.start_at, s])).values());
                setSlots(uniq);
                setSlotStartISO((prev) =>
                    prev && uniq.some((u) => u.start_at === prev) ? prev : uniq[0]?.start_at || '',
                );
                setSlotsLoading(false);
            } catch (error: unknown) {
                // Локальное логирование ошибки загрузки слотов
                const { logError } = require('@/lib/log');
                logError('StaffBookingsView', 'get_free_slots_service_day_v2 error', {
                    message: error instanceof Error ? error.message : String(error),
                });
                if (ignore) return;
                setSlots([]);
                setSlotStartISO('');
                setSlotsLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, selectedStaffId, date, branchId]);

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
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    async function createBooking() {
        const svc = servicesByBranch.find((s) => s.id === serviceId);
        if (!svc)
            return alert(
                t(
                    'staff.cabinet.bookings.create.errors.selectService',
                    'Выберите услугу',
                ),
            );
        if (!slotStartISO)
            return alert(
                t(
                    'staff.cabinet.bookings.create.errors.noSlots',
                    'Нет свободных слотов',
                ),
            );

        const name = newClientName.trim();
        const phone = newClientPhone.trim();

        const nameValidation = validateName(name, true);
        if (!nameValidation.valid) {
            alert(
                nameValidation.error ||
                    t(
                        'staff.cabinet.bookings.create.errors.nameRequired',
                        'Введите имя клиента',
                    ),
            );
            return;
        }

        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            alert(
                phoneValidation.error ||
                    t(
                        'staff.cabinet.bookings.create.errors.phoneRequired',
                        'Введите корректный номер телефона',
                    ),
            );
            return;
        }

        setCreating(true);
        try {
            const bookingId = await createInternalBooking({
                bizId,
                branchId,
                serviceId,
                staffId: selectedStaffId,
                startAtISO: slotStartISO,
                minutes: svc.duration_min,
                clientId: null,
                clientName: name,
                clientPhone: phone,
            });
            alert(
                t(
                    'staff.cabinet.bookings.create.success',
                    `Создана запись #${bookingId.slice(0, 8)}`,
                ),
            );

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

    const canCreate =
        branchId && serviceId && slotStartISO && newClientName.trim() && newClientPhone.trim();

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
                        <option value="">
                            {t('staff.cabinet.bookings.create.selectBranch', 'Выберите филиал')}
                        </option>
                        {branches
                            .filter((b) => b.is_active)
                            .map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
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
                        min={todayStringInTz(TZ)}
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
                        <option value="">
                            {t('staff.cabinet.bookings.create.selectService', 'Выберите услугу')}
                        </option>
                        {servicesByBranch.map((s) => (
                            <option key={s.id} value={s.id}>
                                {getServiceName(s)} ({s.duration_min}м)
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
                        {slots.map((s, i) => {
                            const timeStr = formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm');
                            const isSelected = slotStartISO === s.start_at;
                            return (
                                <button
                                    key={`${s.staff_id}-${s.start_at}-${i}`}
                                    type="button"
                                    onClick={() => setSlotStartISO(s.start_at)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700'
                                    }`}
                                >
                                    {timeStr}
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
                        'Введите данные клиента, который звонит или приходит лично',
                    )}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.cabinet.bookings.create.clientName', 'Имя')}{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t(
                                'staff.cabinet.bookings.create.clientNamePlaceholder',
                                'Введите имя клиента',
                            )}
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.cabinet.bookings.create.clientPhone', 'Телефон')}{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="+996555123456"
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'staff.cabinet.bookings.create.phoneFormat',
                                'Формат: +996555123456',
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    className={`w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                        !canCreate || creating
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:from-indigo-700 hover:to-pink-700'
                    }`}
                    onClick={createBooking}
                    disabled={!canCreate || creating}
                >
                    {creating ? (
                        <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                ></circle>
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            {t('staff.cabinet.bookings.create.creating', 'Создание...')}
                        </>
                    ) : (
                        <>
                            <svg
                                className="w-5 h-5"
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
                            {t('staff.cabinet.bookings.create.create', 'Создать запись')}
                        </>
                    )}
                </button>
            </div>
        </Card>
    );
}

