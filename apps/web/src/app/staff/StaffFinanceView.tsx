'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';

type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    note?: string;
};

type Booking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: { name_ru: string } | { name_ru: string }[] | null;
};

type Shift = {
    id: string;
    shift_date: string;
    opened_at: string | null;
    closed_at: string | null;
    expected_start: string | null;
    late_minutes: number;
    status: 'open' | 'closed';
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    percent_master: number;
    percent_salon: number;
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number;
    topup_amount?: number;
};

type Stats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalLateMinutes: number;
    shiftsCount: number;
};

type TodayResponse =
    | {
          ok: true;
          today:
              | { exists: false; status: 'none'; shift: null; items: ShiftItem[] }
              | { exists: true; status: 'open' | 'closed'; shift: Shift; items: ShiftItem[] };
          bookings?: Booking[];
          services?: string[];
          allShifts?: Array<{
              shift_date: string;
              status: string;
              total_amount: number;
              master_share: number;
              salon_share: number;
              late_minutes: number;
          }>;
          staffPercentMaster?: number;
          staffPercentSalon?: number;
          hourlyRate?: number | null;
          currentHoursWorked?: number | null;
          currentGuaranteedAmount?: number | null;
          isDayOff?: boolean;
          stats: Stats;
      }
    | { ok: false; error: string };

function formatTime(iso: string | null, locale: string) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        const localeMap: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-US' };
        return d.toLocaleTimeString(localeMap[locale] || 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

type TabKey = 'shift' | 'clients' | 'stats';
type PeriodKey = 'day' | 'week' | 'month' | 'all';

export default function StaffFinanceView({ staffId }: { staffId?: string }) {
    const { t, locale } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState<TodayResponse | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('shift');
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [allShifts, setAllShifts] = useState<Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
    }>>([]);
    const [showShiftDetails, setShowShiftDetails] = useState(false);

    const [items, setItems] = useState<ShiftItem[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [availableServices, setAvailableServices] = useState<string[]>([]);
    const [staffPercentMaster, setStaffPercentMaster] = useState(60);
    const [staffPercentSalon, setStaffPercentSalon] = useState(40);
    const [hourlyRate, setHourlyRate] = useState<number | null>(null);
    const [currentHoursWorked, setCurrentHoursWorked] = useState<number | null>(null);
    const [currentGuaranteedAmount, setCurrentGuaranteedAmount] = useState<number | null>(null);
    const [isDayOff, setIsDayOff] = useState(false);
    const [saving, setSaving] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [savingItems, setSavingItems] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const serviceOptions = useMemo(() => {
        const set = new Set<string>();
        // Услуги сотрудника из настроек
        for (const name of availableServices) {
            if (name?.trim()) {
                set.add(name.trim());
            }
        }
        // Услуги из сегодняшних записей
        for (const b of bookings) {
            if (b.services) {
                const list = Array.isArray(b.services) ? b.services : [b.services];
                for (const s of list) {
                    if (s?.name_ru) {
                        set.add(s.name_ru);
                    }
                }
            }
        }
        // Учитываем уже введённые вручную названия услуг в строках смены
        for (const it of items) {
            if (it.serviceName?.trim()) {
                set.add(it.serviceName.trim());
            }
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [availableServices, bookings, items]);

    const load = async () => {
        setLoading(true);
        try {
            // Если передан staffId, используем endpoint для владельца бизнеса
            const apiUrl = staffId 
                ? `/api/dashboard/staff/${staffId}/finance`
                : '/api/staff/shift/today';
            const res = await fetch(apiUrl, { cache: 'no-store' });
            const json: TodayResponse = await res.json();
            setToday(json);
            if (json.ok && json.today.exists && json.today.shift) {
                const sh = json.today.shift;
                const loadedItems = (json.today.items ?? []).map((it: {
                    id?: string;
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    service_amount?: number; // из БД
                    amount?: number; // для обратной совместимости
                    consumablesAmount?: number;
                    consumables_amount?: number; // из БД / для обратной совместимости
                    bookingId?: string | null;
                    booking_id?: string | null; // для обратной совместимости
                    note?: string;
                }) => ({
                    id: it.id,
                    clientName: it.clientName ?? it.client_name ?? '',
                    serviceName: it.serviceName ?? it.service_name ?? '',
                    // Сумма за услугу: сначала из поля service_amount (из БД),
                    // затем из serviceAmount/amount для обратной совместимости
                    serviceAmount:
                        Number(
                            it.service_amount ??
                                it.serviceAmount ??
                                it.amount ??
                                0
                        ) || 0,
                    // Расходники: из consumables_amount (из БД) или других полей
                    consumablesAmount:
                        Number(
                            it.consumables_amount ??
                                it.consumablesAmount ??
                                0
                        ) || 0,
                    bookingId: it.bookingId ?? it.booking_id ?? null,
                    note: it.note,
                }));
                setItems(loadedItems);
            } else {
                setItems([]);
            }
            // Записи за сегодня для выбора клиентов
            if (json.ok && 'bookings' in json && Array.isArray(json.bookings)) {
                setBookings(json.bookings);
            }
            // Услуги сотрудника для выпадающего списка
            if (json.ok && 'services' in json && Array.isArray(json.services)) {
                setAvailableServices(json.services);
            }
            // Проценты из настроек сотрудника (не из смены)
            if (json.ok && 'staffPercentMaster' in json && 'staffPercentSalon' in json) {
                setStaffPercentMaster(Number(json.staffPercentMaster ?? 60));
                setStaffPercentSalon(Number(json.staffPercentSalon ?? 40));
            }
            // Выходной день
            if (json.ok && 'isDayOff' in json) {
                setIsDayOff(Boolean(json.isDayOff));
            }
            // Ставка за час и текущие часы работы
            if (json.ok && 'hourlyRate' in json) {
                setHourlyRate(json.hourlyRate ?? null);
            }
            if (json.ok && 'currentHoursWorked' in json) {
                setCurrentHoursWorked(json.currentHoursWorked ?? null);
            }
            if (json.ok && 'currentGuaranteedAmount' in json) {
                setCurrentGuaranteedAmount(json.currentGuaranteedAmount ?? null);
            }
        } catch (e) {
            console.error('Error loading today shift:', e);
            setToday({ ok: false, error: t('staff.finance.error.loading', 'Не удалось загрузить данные смены') });
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    // Вычисляем состояние смены для использования в useEffect
    const todayShift = today && today.ok && today.today.exists ? today.today.shift : null;
    const isOpen = todayShift && todayShift.status === 'open';
    const isClosed = todayShift && todayShift.status === 'closed';

    // Автосохранение клиентов при изменении (debounce)
    // Отключаем для владельца бизнеса (readonly режим)
    const isReadOnly = !!staffId;
    useEffect(() => {
        // Не сохраняем при первой загрузке, если смена закрыта, или в режиме просмотра
        if (isInitialLoad || !isOpen || isReadOnly) return;
        
        const timeoutId = setTimeout(async () => {
            setSavingItems(true);
            try {
                const res = await fetch('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                });
                const json = await res.json();
                if (!json.ok) {
                    console.error('Error auto-saving items:', json.error);
                }
            } catch (e) {
                console.error('Error auto-saving items:', e);
            } finally {
                setSavingItems(false);
            }
        }, 1000); // сохраняем через 1 секунду после последнего изменения

        return () => clearTimeout(timeoutId);
    }, [items, isOpen, isInitialLoad, isReadOnly]);

    // Автообновление часов работы для открытой смены (каждую минуту)
    useEffect(() => {
        if (!isOpen || !hourlyRate) return;

        const interval = setInterval(() => {
            void load();
        }, 60000); // обновляем каждую минуту

        return () => clearInterval(interval);
    }, [isOpen, hourlyRate]);

    const handleOpenShift = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/staff/shift/open', { method: 'POST' });
            const json = await res.json();
            if (!json.ok) {
                alert(json.error || t('staff.finance.error.openShift', 'Не удалось открыть смену'));
            }
            await load();
        } catch (e) {
            console.error('Error opening shift:', e);
            alert(t('staff.finance.error.openShift', 'Ошибка при открытии смены'));
        } finally {
            setSaving(false);
        }
    };

    const handleCloseShift = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/staff/shift/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                alert(json.error || t('staff.finance.error.closeShift', 'Не удалось закрыть смену'));
            }
            await load();
        } catch (e) {
            console.error('Error closing shift:', e);
            alert(t('staff.finance.error.closeShift', 'Ошибка при закрытии смены'));
        } finally {
            setSaving(false);
        }
    };

    // Вычисляем статистику в зависимости от выбранного периода
    const filteredStats = useMemo(() => {
        const closedShifts = allShifts.filter((s) => s.status === 'closed');
        
        let filtered: typeof closedShifts = [];
        const now = new Date();
        const todayStr = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
        
        if (statsPeriod === 'day') {
            filtered = closedShifts.filter((s) => s.shift_date === todayStr);
        } else if (statsPeriod === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = formatInTimeZone(weekAgo, TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= weekAgoStr && s.shift_date <= todayStr);
        } else if (statsPeriod === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const monthAgoStr = formatInTimeZone(monthAgo, TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= monthAgoStr && s.shift_date <= todayStr);
        } else {
            filtered = closedShifts;
        }
        
        const totalAmount = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        const totalMaster = filtered.reduce((sum, s) => sum + Number(s.master_share || 0), 0);
        const totalSalon = filtered.reduce((sum, s) => sum + Number(s.salon_share || 0), 0);
        const totalLateMinutes = filtered.reduce((sum, s) => sum + Number(s.late_minutes || 0), 0);
        
        return {
            totalAmount,
            totalMaster,
            totalSalon,
            totalLateMinutes,
            shiftsCount: filtered.length,
        };
    }, [allShifts, statsPeriod]);
    
    const stats: Stats | null = filteredStats;

    // Сумма услуг = сумма всех serviceAmount
    const totalServiceFromItems = items.reduce(
        (sum, it) => sum + (Number(it.serviceAmount ?? 0) || 0),
        0
    );
    // Сумма расходников = сумма всех consumablesAmount
    const totalConsumablesFromItems = items.reduce(
        (sum, it) => sum + (Number(it.consumablesAmount ?? 0) || 0),
        0
    );

    const totalAmount = totalServiceFromItems;
    const finalConsumables = totalConsumablesFromItems;

    // Проценты считаются от общей суммы услуг (до вычета расходников)
    // Расходники добавляются к доле бизнеса сверху
    const pM = staffPercentMaster;
    const pS = staffPercentSalon;
    const ps = pM + pS || 100;
    // Базовая доля сотрудника = процент от общей суммы услуг
    const baseStaffShare = Math.round((totalAmount * pM) / ps);
    // Базовая доля бизнеса = процент от общей суммы услуг + 100% расходников
    const baseBizShareFromAmount = Math.round((totalAmount * pS) / ps);
    const baseBizShare = baseBizShareFromAmount + finalConsumables;

    // С учётом оплаты за выход:
    // если гарантированная сумма за выход больше базовой доли сотрудника,
    // разница вычитается из доли бизнеса
    let mShare = baseStaffShare;
    let sShare = baseBizShare;

    // Для открытой смены используем текущую гарантированную сумму
    if (isOpen && hourlyRate && currentGuaranteedAmount !== null && currentGuaranteedAmount !== undefined) {
        const guarantee = currentGuaranteedAmount;
        if (guarantee > baseStaffShare) {
            const diff = Math.round((guarantee - baseStaffShare) * 100) / 100;
            mShare = Math.round(guarantee);
            sShare = baseBizShare - diff;
        }
    }

    // Для закрытой смены используем сохранённые значения guaranteed_amount и topup_amount
    if (isClosed && todayShift) {
        const guaranteed = todayShift.guaranteed_amount ?? null;
        const topup = todayShift.topup_amount ?? 0;
        if (guaranteed !== null && guaranteed > baseStaffShare) {
            const diff = Math.round(topup * 100) / 100 || Math.round((guaranteed - baseStaffShare) * 100) / 100;
            mShare = baseStaffShare + diff;
            sShare = baseBizShare - diff;
        }
    }

    const localeMap: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-US' };
    const todayLabel = new Date().toLocaleDateString(localeMap[locale] || 'ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    // Компонент табов
    const Tabs = () => (
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
                onClick={() => setActiveTab('shift')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'shift'
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
                {t('staff.finance.tabs.shift', 'Текущая смена')}
            </button>
            <button
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'clients'
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
                {t('staff.finance.tabs.clients', 'Клиенты')} {items.length > 0 && `(${items.length})`}
            </button>
            {stats && (
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        activeTab === 'stats'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                    {t('staff.finance.tabs.stats', 'Статистика')}
                </button>
            )}
        </div>
    );

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {t('staff.finance.title', 'Финансы')}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('staff.finance.subtitle', 'Управление сменой, клиентами и тем, сколько получает сотрудник и бизнес')}
                </p>
            </div>

            <Tabs />

            {/* Таб: Текущая смена */}
            {activeTab === 'shift' && (
                <Card variant="elevated" className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('staff.finance.shift.current', 'Текущая смена')}
                            </div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {todayLabel} ({TZ})
                            </div>
                            {todayShift && (
                                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <div>{t('staff.finance.shift.opened', 'Открыта')}: {formatTime(todayShift.opened_at, locale)}</div>
                                    {showShiftDetails && (
                                        <>
                                            <div>
                                                {t('staff.finance.shift.expectedStart', 'Плановый старт')}:{' '}
                                                {todayShift.expected_start
                                                    ? formatTime(todayShift.expected_start, locale)
                                                    : t('staff.finance.shift.notSet', 'не задан')}
                                            </div>
                                            <div>
                                                {t('staff.finance.shift.late', 'Опоздание')}:{' '}
                                                {todayShift.late_minutes > 0
                                                    ? `${todayShift.late_minutes} ${t('staff.finance.shift.minutes', 'мин')}`
                                                    : t('staff.finance.shift.no', 'нет')}
                                            </div>
                                        </>
                                    )}
                                    {/* Показываем оплату за выход, если указана ставка за час */}
                                    {((isOpen && hourlyRate && currentHoursWorked !== null && currentGuaranteedAmount !== null) ||
                                        (isClosed && todayShift.hourly_rate && todayShift.hours_worked !== null && todayShift.hours_worked !== undefined)) && (
                                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {t('staff.finance.shift.guaranteedPayment', 'Оплата за выход')}
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.shift.hoursWorked', 'Отработано')}:</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {isOpen
                                                            ? currentHoursWorked?.toFixed(2) ?? '0.00'
                                                            : todayShift.hours_worked?.toFixed(2) ?? '0.00'}{' '}
                                                        {t('staff.finance.shift.hours', 'ч')}
                                                    </span>
                                                </div>
                                                {showShiftDetails && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.shift.rate', 'Ставка')}:</span>
                                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                                            {isOpen
                                                                ? hourlyRate ?? 0
                                                                : todayShift.hourly_rate ?? 0}{' '}
                                                            {t('staff.finance.shift.somPerHour', 'сом/ч')}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                                                    <span className="font-medium text-green-600 dark:text-green-400">
                                                        {t('staff.finance.shift.toReceive', 'К получению за выход')}:
                                                    </span>
                                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                                        {isOpen
                                                            ? currentGuaranteedAmount?.toFixed(2) ?? '0.00'
                                                            : todayShift.guaranteed_amount?.toFixed(2) ?? '0.00'}{' '}
                                                        {t('staff.finance.shift.som', 'сом')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {todayShift && (
                                        <button
                                            type="button"
                                            onClick={() => setShowShiftDetails(!showShiftDetails)}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                                        >
                                            {showShiftDetails ? t('staff.finance.shift.hideDetails', 'Скрыть детали') : t('staff.finance.shift.showDetails', 'Показать детали')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    <div className="flex gap-2 items-center flex-wrap">
                         {!todayShift && (
                             <>
                                 {isDayOff ? (
                                     <div className="text-sm text-amber-600 dark:text-amber-400 font-medium px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                         {t('staff.finance.shift.dayOff', 'Сегодня у вас выходной день. Нельзя открыть смену.')}
                                     </div>
                                 ) : (
                                     <Button
                                         variant="primary"
                                         onClick={handleOpenShift}
                                         disabled={loading || saving || isDayOff}
                                         isLoading={saving}
                                     >
                                         {t('staff.finance.shift.open', 'Открыть смену')}
                                     </Button>
                                 )}
                             </>
                         )}
                         {isOpen && (
                             <>
                                 <Button
                                     variant="outline"
                                     onClick={load}
                                     disabled={loading || saving}
                                 >
                                     {t('staff.finance.shift.refresh', 'Обновить')}
                                 </Button>
                                 <Button
                                     variant="primary"
                                     onClick={handleCloseShift}
                                     disabled={saving}
                                     isLoading={saving}
                                 >
                                     {t('staff.finance.shift.close', 'Закрыть смену')}
                                 </Button>
                             </>
                         )}
                         {isClosed && (
                             <>
                                 <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                     {t('staff.finance.shift.closed', 'Смена закрыта')}
                                 </div>
                                 <Button
                                     variant="outline"
                                     onClick={handleOpenShift}
                                     disabled={saving}
                                     isLoading={saving}
                                 >
                                     {t('staff.finance.shift.reopen', 'Переоткрыть смену')}
                                 </Button>
                             </>
                         )}
                    </div>
                </div>

                    {/* Краткое резюме по деньгам за смену */}
                    {todayShift && (
                        <div className="mt-4 grid sm:grid-cols-2 gap-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-4 py-3">
                            <div className="space-y-1">
                                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.summary.toStaff', 'Итого сотруднику за смену')}
                                </div>
                                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                                    {mShare} {t('staff.finance.shift.som', 'сом')}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.summary.includesPercent', 'Учитывает проценты и оплату за выход')}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.summary.toBusiness', 'Итого бизнесу за смену')}
                                </div>
                                <div className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                                    {sShare} {t('staff.finance.shift.som', 'сом')}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.summary.includesConsumables', 'Включая все расходники и возможные доплаты сотруднику')}
                                </div>
                            </div>
                        </div>
                    )}

                    {showShiftDetails && (
                        <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('staff.finance.details.serviceAmount', 'Сумма за услуги (сом)')}
                            </label>
                            <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                                {totalAmount} {t('staff.finance.shift.som', 'сом')}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t('staff.finance.details.autoCalculated', 'Считается автоматически по списку клиентов ниже')}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('staff.finance.details.consumables', 'Расходники (сом)')}
                            </label>
                            <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                                {finalConsumables} {t('staff.finance.shift.som', 'сом')}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t('staff.finance.details.autoCalculated', 'Считается автоматически по списку клиентов ниже')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('staff.finance.details.staffShare', 'Доля сотрудника (%)')}
                                </label>
                                <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                                    {staffPercentMaster}%
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.details.fromSettings', 'Из настроек сотрудника')}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('staff.finance.details.businessShare', 'Доля бизнеса (%)')}
                                </label>
                                <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                                    {staffPercentSalon}%
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.details.fromSettings', 'Из настроек сотрудника')}
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t('staff.finance.details.staffShareAmount', 'Доля сотрудника')}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {mShare} {t('staff.finance.shift.som', 'сом')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t('staff.finance.details.businessShareAmount', 'Доля бизнеса (включая расходники)')}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {sShare} {t('staff.finance.shift.som', 'сом')}
                                </span>
                            </div>
                            {/* Показываем оплату за выход для открытой смены */}
                            {isOpen && hourlyRate && currentHoursWorked !== null && currentGuaranteedAmount !== null && (
                                <>
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            {t('staff.finance.shift.guaranteedPayment', 'Оплата за выход')}
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {t('staff.finance.shift.hoursWorked', 'Отработано часов')}
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {currentHoursWorked.toFixed(2)} {t('staff.finance.shift.hours', 'ч')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {t('staff.finance.shift.rate', 'Ставка за час')}
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {hourlyRate} {t('staff.finance.shift.somPerHour', 'сом/ч')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    {t('staff.finance.shift.toReceive', 'К получению за выход')}:
                                                </span>
                                                <span className="font-semibold text-green-600 dark:text-green-400">
                                                    {currentGuaranteedAmount.toFixed(2)} {t('staff.finance.shift.som', 'сом')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            {/* Показываем оплату за выход для закрытой смены */}
                            {isClosed && todayShift && todayShift.hourly_rate && todayShift.hours_worked !== null && todayShift.hours_worked !== undefined && (
                                <>
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Оплата за выход
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Отработано часов
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.hours_worked.toFixed(2)} ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Ставка за час
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.hourly_rate} сом/ч
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {t('staff.finance.details.guaranteedAmount', 'Гарантированная сумма за выход')}
                                                </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {todayShift.guaranteed_amount?.toFixed(2) ?? '0.00'} {t('staff.finance.shift.som', 'сом')}
                                                </span>
                                            </div>
                                            {todayShift.topup_amount && todayShift.topup_amount > 0 && (
                                                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                        {t('staff.finance.details.ownerTopup', 'Доплата владельца')}
                                                    </span>
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                        +{todayShift.topup_amount.toFixed(2)} {t('staff.finance.shift.som', 'сом')}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    {t('staff.finance.details.totalToReceive', 'Итого к получению')}
                                                </span>
                                                <span className="font-semibold text-green-600 dark:text-green-400">
                                                    {((todayShift.guaranteed_amount ?? 0) + (todayShift.topup_amount ?? 0)).toFixed(2)} {t('staff.finance.shift.som', 'сом')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {t('staff.finance.details.note', 'Примечание: расходники 100% идут бизнесу')}
                            </p>
                        </div>
                    </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Таб: Клиенты */}
            {activeTab === 'clients' && (
                <Card variant="elevated" className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('staff.finance.clients.title', 'Клиенты за смену')}
                    </h2>
                    {isOpen && (
                        <div className="flex items-center gap-2">
                            {savingItems && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.clients.saving', 'Сохранение...')}
                                </span>
                            )}
                            {!isReadOnly && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setItems((prev) => {
                                            // считаем следующий порядковый номер для анонимного клиента
                                            const nextIndex =
                                                prev.filter((it) => !it.bookingId).length + 1;
                                            const newItem: ShiftItem = {
                                                clientName: `${t('staff.finance.clients.client', 'Клиент')} ${nextIndex}`,
                                                serviceName: '',
                                                serviceAmount: 0,
                                                consumablesAmount: 0,
                                                bookingId: null,
                                                note: '',
                                            };
                                            const next = [newItem, ...prev];
                                            // сразу открываем форму редактирования для нового клиента
                                            setExpandedItems(new Set([0]));
                                            return next;
                                        });
                                    }}
                                    disabled={saving || savingItems}
                                >
                                    {t('staff.finance.clients.add', 'Добавить клиента')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {!todayShift || !isOpen ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                        {t('staff.finance.clients.shiftNotOpen', 'Чтобы добавлять клиентов, необходимо сначала открыть смену на вкладке «Текущая смена».')}
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('staff.finance.clients.empty', 'Пока нет добавленных клиентов. Добавьте клиента из записей или введите вручную, укажите суммы за услугу и расходники.')}
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        {/* Заголовок колонок (для понимания структуры) */}
                        <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1fr] gap-4 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <span>{t('staff.finance.clients.client', 'Клиент')}</span>
                            <span>{t('staff.finance.clients.service', 'Услуга / комментарий')}</span>
                            <span className="text-right">{t('staff.finance.clients.amount', 'Сумма')}</span>
                            <span className="text-right">{t('staff.finance.clients.consumables', 'Расходники')}</span>
                        </div>

                        {items.map((item, idx) => {
                            const usedBookingIds = items.filter((it, i) => i !== idx && it.bookingId).map(it => it.bookingId);
                            const now = new Date();
                            // В выпадающем списке показываем только тех клиентов, чьё время уже наступило
                            const availableBookings = bookings.filter((b) => {
                                if (usedBookingIds.includes(b.id)) return false;
                                try {
                                    const start = new Date(b.start_at);
                                    return start <= now;
                                } catch {
                                    return false;
                                }
                            });
                            const isExpanded = expandedItems.has(idx);
                            
                            // Компактная строка (свернутое состояние)
                            if (!isExpanded) {
                                return (
                                    <div
                                        key={item.id ?? idx}
                                        className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${isOpen && !isReadOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors' : ''}`}
                                        onClick={() => isOpen && !isReadOnly && setExpandedItems((prev) => new Set(prev).add(idx))}
                                    >
                                        <div className="flex-1 grid grid-cols-[2fr,2fr,1fr,1fr] gap-4 items-center">
                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                {item.clientName || t('staff.finance.clients.notSpecified', 'Клиент не указан')}
                                            </div>
                                            <div className="text-gray-600 dark:text-gray-400">
                                                {item.serviceName || '—'}
                                            </div>
                                            <div className="text-right font-medium text-gray-900 dark:text-gray-100">
                                                {(item.serviceAmount ?? 0) === 0 && !item.serviceName
                                                    ? '—'
                                                    : `${item.serviceAmount ?? 0} ${t('staff.finance.shift.som', 'сом')}`}
                                            </div>
                                            <div className="text-right font-medium text-gray-900 dark:text-gray-100">
                                                {(item.consumablesAmount ?? 0) === 0
                                                    ? `0 ${t('staff.finance.shift.som', 'сом')}`
                                                    : `${item.consumablesAmount} ${t('staff.finance.shift.som', 'сом')}`}
                                            </div>
                                        </div>
                                        {isOpen && !isReadOnly && (
                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    type="button"
                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedItems((prev) => new Set(prev).add(idx));
                                                    }}
                                                >
                                                    {t('staff.finance.clients.edit', 'Редактировать')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setItems((prev) => prev.filter((_, i) => i !== idx));
                                                        setExpandedItems((prev) => {
                                                            const next = new Set(prev);
                                                            next.delete(idx);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    {t('staff.finance.clients.delete', 'Удалить')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            
                            // Раскрытая форма редактирования
                            return (
                                <div
                                    key={item.id ?? idx}
                                    className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{t('staff.finance.clients.editing', 'Редактирование клиента')}</h3>
                                        <button
                                            type="button"
                                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                            onClick={() => setExpandedItems((prev) => {
                                                const next = new Set(prev);
                                                next.delete(idx);
                                                return next;
                                            })}
                                        >
                                            {t('staff.finance.clients.collapse', 'Свернуть')}
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {t('staff.finance.clients.client', 'Клиент')}
                                        </label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                                            value={item.bookingId ?? ''}
                                            onChange={(e) => {
                                                const bookingId = e.target.value || null;
                                                const booking = bookingId
                                                    ? bookings.find((b) => b.id === bookingId)
                                                    : null;
                                                const service = booking?.services
                                                    ? Array.isArray(booking.services)
                                                        ? booking.services[0]
                                                        : booking.services
                                                    : null;
                                                setItems((prev) =>
                                                    prev.map((it, i) =>
                                                        i === idx
                                                            ? {
                                                                  ...it,
                                                                  bookingId,
                                                                  clientName: booking
                                                                      ? booking.client_name ||
                                                                        booking.client_phone ||
                                                                        it.clientName
                                                                      : it.clientName,
                                                                  serviceName: service
                                                                      ? service.name_ru
                                                                      : it.serviceName,
                                                              }
                                                            : it
                                                    )
                                                );
                                            }}
                                            disabled={!isOpen || isReadOnly}
                                        >
                                            <option value="">{t('staff.finance.clients.selectFromBookings', 'Выберите клиента из записей...')}</option>
                                            {availableBookings.map((b) => {
                                                const service = b.services
                                                    ? Array.isArray(b.services)
                                                        ? b.services[0]
                                                        : b.services
                                                    : null;
                                                const clientLabel = b.client_name || b.client_phone || t('staff.finance.clients.client', 'Клиент');
                                                const serviceLabel = service?.name_ru || '';
                                                const localeMap: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-US' };
                                                const time = new Date(b.start_at).toLocaleTimeString(localeMap[locale] || 'ru-RU', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                });
                                                return (
                                                    <option key={b.id} value={b.id}>
                                                        {clientLabel} - {serviceLabel} ({time})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {!item.bookingId && (
                                            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                {t('staff.finance.clients.walkInHint', 'Для клиентов «с улицы» имя будет сохранено автоматически как «{name}».').replace('{name}', item.clientName)}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {t('staff.finance.clients.service', 'Услуга')}
                                        </label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={item.serviceName}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setItems((prev) =>
                                                    prev.map((it, i) =>
                                                        i === idx ? { ...it, serviceName: value } : it
                                                    )
                                                );
                                            }}
                                            disabled={!isOpen || isReadOnly}
                                        >
                                            <option value="">{t('staff.finance.clients.selectService', 'Выберите услугу...')}</option>
                                            {serviceOptions.map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                {t('staff.finance.clients.servicePrice', 'Цена за услугу (сом)')}
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-right"
                                                value={item.serviceAmount || ''}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value || 0);
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === idx ? { ...it, serviceAmount: v } : it
                                                        )
                                                    );
                                                }}
                                                disabled={!isOpen || isReadOnly}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                {t('staff.finance.clients.consumablesAmount', 'Расходники (сом)')}
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-right"
                                                value={item.consumablesAmount || ''}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value || 0);
                                                    setItems((prev) =>
                                                        prev.map((it, i) =>
                                                            i === idx ? { ...it, consumablesAmount: v } : it
                                                        )
                                                    );
                                                }}
                                                disabled={!isOpen || isReadOnly}
                                            />
                                        </div>
                                    </div>
                                    
                                    {isOpen && !isReadOnly && (
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                type="button"
                                                className="px-3 py-1 text-sm border rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => {
                                                    setExpandedItems((prev) => {
                                                        const next = new Set(prev);
                                                        next.delete(idx);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {t('staff.finance.clients.cancel', 'Отмена')}
                                            </button>
                                            <button
                                                type="button"
                                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                                onClick={() => {
                                                    setExpandedItems((prev) => {
                                                        const next = new Set(prev);
                                                        next.delete(idx);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {t('staff.finance.clients.save', 'Сохранить')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
            )}

            {/* Таб: Статистика */}
            {activeTab === 'stats' && stats && (
                <Card variant="elevated" className="p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {t('staff.finance.stats.title', 'Общая статистика по сменам')}
                        </h2>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('staff.finance.stats.totalShifts', 'Всего закрытых смен')}: {stats.shiftsCount}
                        </div>
                    </div>
                    
                    {/* Фильтры по периодам */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setStatsPeriod('day')}
                            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                statsPeriod === 'day'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.finance.stats.period.day', 'День')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatsPeriod('week')}
                            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                statsPeriod === 'week'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.finance.stats.period.week', 'Неделя')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatsPeriod('month')}
                            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                statsPeriod === 'month'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.finance.stats.period.month', 'Месяц')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatsPeriod('all')}
                            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                statsPeriod === 'all'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('staff.finance.stats.period.all', 'Все время')}
                        </button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.totalRevenue', 'Общая выручка')}</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalAmount} {t('staff.finance.shift.som', 'сом')}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.staffAmount', 'Сумма сотрудника')}</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalMaster} {t('staff.finance.shift.som', 'сом')}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.businessAmount', 'Сумма бизнеса')}</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {stats.totalSalon} {t('staff.finance.shift.som', 'сом')}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        {t('staff.finance.stats.totalLate', 'Суммарное опоздание')}: {stats.totalLateMinutes} {t('staff.finance.shift.minutes', 'минут')}
                    </div>
                </Card>
            )}
        </main>
    );
}


