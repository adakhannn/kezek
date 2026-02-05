'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';
import { validateName, validatePhone } from '@/lib/validation';

type Booking = {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number } | null | { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    branches: { name: string; lat: number | null; lon: number | null; address: string | null } | null | { name: string; lat: number | null; lon: number | null; address: string | null }[];
    businesses: { name: string; slug: string | null } | null | { name: string; slug: string | null }[];
};

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    active: boolean;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    is_active: boolean;
    branch_id: string;
};

type Branch = {
    id: string;
    name: string;
    is_active: boolean;
};

type RpcSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

export default function StaffBookingsView({
    bizId,
    staffId,
    branchId: defaultBranchId,
    upcoming,
    past,
    services,
    staff,
    branches,
}: {
    bizId: string;
    staffId: string;
    branchId: string | null;
    upcoming: Booking[];
    past: Booking[];
    services: Service[];
    staff: Staff[];
    branches: Branch[];
}) {
    const { t, locale } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past' | 'create'>('upcoming');

    function formatDateTime(iso: string): string {
        const date = new Date(iso);
        const localeMap: Record<string, string> = {
            ky: 'ru-KG',
            ru: 'ru-RU',
            en: 'en-US',
        };
        
        const dateFormatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: TZ,
        });
        
        return dateFormatter.format(date);
    }

    function formatTime(iso: string): string {
        const date = new Date(iso);
        const localeMap: Record<string, string> = {
            ky: 'ru-KG',
            ru: 'ru-RU',
            en: 'en-US',
        };
        
        const timeFormatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: TZ,
        });
        
        return timeFormatter.format(date);
    }

    function getServiceName(service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null): string {
        if (!service) return t('staff.cabinet.bookings.card.serviceDefault', 'Услуга');
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    function formatText(text: string | null | undefined, defaultText: string): string {
        if (!text) return defaultText;
        if (locale === 'en') return transliterate(text);
        return text;
    }

    function getStatusBadge(status: string) {
        const statusMap: Record<string, { labelKey: string; className: string }> = {
            hold: { labelKey: 'staff.cabinet.status.hold', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
            confirmed: { labelKey: 'staff.cabinet.status.confirmed', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            paid: { labelKey: 'staff.cabinet.status.paid', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            cancelled: { labelKey: 'staff.cabinet.status.cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
            no_show: { labelKey: 'staff.cabinet.status.noShow', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
        };
        const s = statusMap[status] || { labelKey: '', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
        const label = s.labelKey ? t(s.labelKey, status) : status;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
                {label}
            </span>
        );
    }

    const bookings = tab === 'upcoming' ? upcoming : past;

    // Компонент для создания бронирований
    function CreateBookingForm() {
        const [branchId, setBranchId] = useState<string>(defaultBranchId || '');
        const [serviceId, setServiceId] = useState<string>('');
        const [selectedStaffId, setSelectedStaffId] = useState<string>(staffId);
        const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
        const [slots, setSlots] = useState<RpcSlot[]>([]);
        const [slotStartISO, setSlotStartISO] = useState<string>('');
        const [slotsLoading, setSlotsLoading] = useState(false);
        const [creating, setCreating] = useState(false);

        // Режимы клиента
        type ClientMode = 'none' | 'new';
        const [clientMode, setClientMode] = useState<ClientMode>('new');
        const [newClientName, setNewClientName] = useState('');
        const [newClientPhone, setNewClientPhone] = useState('');

        // Фильтруем услуги по выбранному филиалу
        const servicesByBranch = useMemo(() => {
            if (!branchId) return [];
            return services.filter(s => s.branch_id === branchId && s.active);
        }, [services, branchId]);

        // Фильтруем сотрудников по выбранному филиалу
        const staffByBranch = useMemo(() => {
            if (!branchId) return [];
            return staff.filter(s => s.branch_id === branchId && s.is_active);
        }, [staff, branchId]);

        // Загрузка слотов
        useEffect(() => {
            let ignore = false;
            (async () => {
                if (!branchId || !serviceId || !date || !selectedStaffId) {
                    setSlots([]);
                    setSlotStartISO('');
                    setSlotsLoading(false);
                    return;
                }

                setSlotsLoading(true);
                const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                    p_biz_id: bizId,
                    p_service_id: serviceId,
                    p_day: date,
                    p_per_staff: 400,
                    p_step_min: 15,
                });
                if (ignore) return;
                if (error) {
                    console.error('[StaffBooking] get_free_slots_service_day_v2 error:', error.message || error);
                    setSlots([]);
                    setSlotStartISO('');
                    setSlotsLoading(false);
                    return;
                }
                const raw = (data || []) as RpcSlot[];
                const now = new Date();
                const minTime = addMinutes(now, 30);

                const filtered = raw
                    .filter(s => s.branch_id === branchId)
                    .filter(s => s.staff_id === selectedStaffId)
                    .filter(s => new Date(s.start_at) > minTime);

                const uniq = Array.from(new Map(filtered.map(s => [s.start_at, s])).values());
                setSlots(uniq);
                setSlotStartISO(prev => (prev && uniq.some(u => u.start_at === prev)) ? prev : (uniq[0]?.start_at || ''));
                setSlotsLoading(false);
            })();
            return () => { ignore = true; };
        }, [bizId, serviceId, selectedStaffId, date, branchId]);

        // Сброс при смене филиала
        useEffect(() => {
            setServiceId('');
            setSelectedStaffId(staffId);
            setSlots([]);
            setSlotStartISO('');
        }, [branchId, staffId]);

        // Сброс при смене даты
        useEffect(() => {
            setSlots([]);
            setSlotStartISO('');
        }, [date]);

        // Сброс при смене мастера
        useEffect(() => {
            setSlots([]);
            setSlotStartISO('');
        }, [selectedStaffId]);

        function getServiceName(service: Service): string {
            if (locale === 'ky' && service.name_ky) return service.name_ky;
            if (locale === 'en' && service.name_en) return service.name_en;
            return service.name_ru;
        }

        async function createBooking() {
            const svc = servicesByBranch.find(s => s.id === serviceId);
            if (!svc) return alert(t('staff.cabinet.bookings.create.errors.selectService', 'Выберите услугу'));
            if (!slotStartISO) return alert(t('staff.cabinet.bookings.create.errors.noSlots', 'Нет свободных слотов'));
            if (!selectedStaffId) return alert(t('staff.cabinet.bookings.create.errors.selectStaff', 'Выберите мастера'));

            let p_client_id: string | null = null;
            let p_client_name: string | null = null;
            let p_client_phone: string | null = null;

            if (clientMode === 'new') {
                const name = newClientName.trim();
                const phone = newClientPhone.trim();

                const nameValidation = validateName(name, true);
                if (!nameValidation.valid) {
                    alert(nameValidation.error || t('staff.cabinet.bookings.create.errors.nameRequired', 'Введите имя клиента'));
                    return;
                }

                const phoneValidation = validatePhone(phone, true);
                if (!phoneValidation.valid) {
                    alert(phoneValidation.error || t('staff.cabinet.bookings.create.errors.phoneRequired', 'Введите корректный номер телефона'));
                    return;
                }

                p_client_name = name;
                p_client_phone = phone;
            }

            setCreating(true);
            try {
                const { data, error } = await supabase.rpc('create_internal_booking', {
                    p_biz_id: bizId,
                    p_branch_id: branchId,
                    p_service_id: serviceId,
                    p_staff_id: selectedStaffId,
                    p_start: slotStartISO,
                    p_minutes: svc.duration_min,
                    p_client_id,
                    p_client_name,
                    p_client_phone,
                });
                if (error) {
                    alert(error.message);
                    return;
                }

                const bookingId = String(data);
                alert(t('staff.cabinet.bookings.create.success', `Создана запись #${bookingId.slice(0, 8)}`));

                // Сброс формы
                setServiceId('');
                setSlotStartISO('');
                setSlots([]);
                setClientMode('new');
                setNewClientName('');
                setNewClientPhone('');
                
                // Обновление страницы
                window.location.reload();
            } finally {
                setCreating(false);
            }
        }

        const canCreate = branchId && serviceId && selectedStaffId && slotStartISO &&
            (clientMode === 'none' || (clientMode === 'new' && newClientName.trim() && newClientPhone.trim()));

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
                            {branches.filter(b => b.is_active).map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
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
                            {t('staff.cabinet.bookings.create.staff', 'Мастер')}
                        </label>
                        <select
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            disabled={!branchId}
                        >
                            <option value="">{t('staff.cabinet.bookings.create.selectStaff', 'Выберите мастера')}</option>
                            {staffByBranch.map(s => (
                                <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.cabinet.bookings.create.service', 'Услуга')}
                        </label>
                        <select
                            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={serviceId}
                            onChange={(e) => setServiceId(e.target.value)}
                            disabled={!branchId || !selectedStaffId}
                        >
                            <option value="">{t('staff.cabinet.bookings.create.selectService', 'Выберите услугу')}</option>
                            {servicesByBranch.map(s => (
                                <option key={s.id} value={s.id}>{getServiceName(s)} ({s.duration_min}м)</option>
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
                ) : branchId && selectedStaffId && serviceId && date ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        {t('staff.cabinet.bookings.create.noSlots', 'Нет свободных слотов')}
                    </div>
                ) : null}

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('staff.cabinet.bookings.create.client', 'Клиент')}
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="clientMode"
                                checked={clientMode === 'none'}
                                onChange={() => setClientMode('none')}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {t('staff.cabinet.bookings.create.clientNone', 'Без клиента (walk-in)')}
                            </span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="clientMode"
                                checked={clientMode === 'new'}
                                onChange={() => setClientMode('new')}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {t('staff.cabinet.bookings.create.clientNew', 'Новый клиент (звонок/лично)')}
                            </span>
                        </label>
                    </div>

                    {clientMode === 'new' && (
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
                    )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        className={`w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                            !canCreate || creating ? 'opacity-50 cursor-not-allowed' : 'hover:from-indigo-700 hover:to-pink-700'
                        }`}
                        onClick={createBooking}
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

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Заголовок */}
                <Card variant="elevated" className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {t('staff.cabinet.bookings.title', 'Мои записи')}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {t('staff.cabinet.bookings.subtitle', 'Управляйте своими записями')}
                            </p>
                        </div>
                        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'upcoming'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('upcoming')}
                            >
                                {t('staff.cabinet.bookings.tabs.upcoming', 'Предстоящие')} ({upcoming.length})
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'past'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('past')}
                            >
                                {t('staff.cabinet.bookings.tabs.past', 'Прошедшие')} ({past.length})
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'create'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('create')}
                            >
                                {t('staff.cabinet.bookings.tabs.create', 'Создать запись')}
                            </button>
                        </div>
                    </div>
                </Card>

                {tab === 'create' ? (
                    <CreateBookingForm />
                ) : bookings.length === 0 ? (
                    <Card variant="elevated" className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            {tab === 'upcoming' 
                                ? t('staff.cabinet.bookings.empty.upcoming', 'Нет предстоящих записей')
                                : t('staff.cabinet.bookings.empty.past', 'Нет прошедших записей')
                            }
                        </p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {bookings.map((booking) => {
                            const clientName = booking.client_name || booking.client_phone || t('staff.cabinet.bookings.card.clientDefault', 'Клиент');
                            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                            const branch = Array.isArray(booking.branches) ? booking.branches[0] : booking.branches;
                            const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
                            const serviceName = getServiceName(service);
                            const branchName = branch?.name 
                                ? formatText(branch.name, t('staff.cabinet.bookings.card.branchDefault', 'Филиал'))
                                : t('staff.cabinet.bookings.card.branchDefault', 'Филиал');
                            const businessName = business?.name 
                                ? formatText(business.name, t('staff.cabinet.bookings.card.businessDefault', 'Бизнес'))
                                : t('staff.cabinet.bookings.card.businessDefault', 'Бизнес');

                            return (
                                <Card key={booking.id} variant="elevated" className="p-6 hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                    {serviceName}
                                                </h3>
                                                {getStatusBadge(booking.status)}
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.time', 'Время')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {formatDateTime(booking.start_at)} - {formatDateTime(booking.end_at)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.client', 'Клиент')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{clientName}</div>
                                                    {booking.client_phone && (
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">{booking.client_phone}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.branch', 'Филиал')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{branchName}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.business', 'Бизнес')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{businessName}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/booking/${booking.id}`}>
                                                <Button variant="outline" size="sm">
                                                    {t('staff.cabinet.bookings.card.details', 'Подробнее')}
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

