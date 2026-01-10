'use client';

import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import MonthPickerPopover from '@/components/pickers/MonthPickerPopover';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { todayTz, TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';

type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    note?: string;
};

type ServiceName = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
};

type Booking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: ServiceName | ServiceName[] | null;
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
          services?: ServiceName[] | string[]; // Поддержка старого (string[]) и нового (ServiceName[]) форматов
          allShifts?: Array<{
              shift_date: string;
              status: string;
              total_amount: number;
              master_share: number;
              salon_share: number;
              late_minutes: number;
              guaranteed_amount?: number;
              topup_amount?: number;
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
type PeriodKey = 'day' | 'month' | 'year' | 'all';

export default function StaffFinanceView({ staffId }: { staffId?: string }) {
    const { t, locale } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState<TodayResponse | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('shift');
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [selectedDate, setSelectedDate] = useState<Date>(todayTz());
    const [selectedMonth, setSelectedMonth] = useState<Date>(todayTz());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [allShifts, setAllShifts] = useState<Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }>>([]);
    const [showShiftDetails, setShowShiftDetails] = useState(false);

    const [items, setItems] = useState<ShiftItem[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [availableServices, setAvailableServices] = useState<ServiceName[]>([]);
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
    
    // Функция для получения правильного названия услуги с учетом языка
    function getServiceName(service: ServiceName | string): string {
        if (typeof service === 'string') {
            // Если это строка (вручную введенное название), используем транслитерацию для английского
            if (locale === 'en') return transliterate(service);
            return service;
        }
        
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    const serviceOptions = useMemo(() => {
        const set = new Set<string>();
        const serviceMap = new Map<string, ServiceName>();
        
        // Услуги сотрудника из настроек
        for (const svc of availableServices) {
            if (svc?.name_ru?.trim()) {
                const key = svc.name_ru.trim();
                set.add(key);
                serviceMap.set(key, svc);
            }
        }
        // Услуги из сегодняшних записей
        for (const b of bookings) {
            if (b.services) {
                const list = Array.isArray(b.services) ? b.services : [b.services];
                for (const s of list) {
                    if (s?.name_ru?.trim()) {
                        const key = s.name_ru.trim();
                        set.add(key);
                        serviceMap.set(key, s);
                    }
                }
            }
        }
        // Учитываем уже введённые вручную названия услуг в строках смены
        for (const it of items) {
            if (it.serviceName?.trim()) {
                const key = it.serviceName.trim();
                set.add(key);
                // Если это не было в списке услуг, создаем объект только с name_ru
                if (!serviceMap.has(key)) {
                    serviceMap.set(key, { name_ru: key });
                }
            }
        }
        
        // Возвращаем массив объектов ServiceName, отсортированный по переведенному названию
        return Array.from(set)
            .map(key => serviceMap.get(key)!)
            .sort((a, b) => {
                const nameA = getServiceName(a);
                const nameB = getServiceName(b);
                return nameA.localeCompare(nameB, locale === 'ru' ? 'ru' : locale === 'ky' ? 'ky' : 'en');
            });
    }, [availableServices, bookings, items, locale]);

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
                // API может возвращать либо строки (старый формат), либо объекты ServiceName (новый формат)
                const services = json.services.map((svc: string | ServiceName) => {
                    if (typeof svc === 'string') {
                        // Старый формат - строка, преобразуем в объект
                        return { name_ru: svc };
                    }
                    // Новый формат - объект ServiceName
                    return svc;
                });
                setAvailableServices(services);
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
            // Загружаем все смены для статистики
            if (json.ok && 'allShifts' in json && Array.isArray(json.allShifts)) {
                console.log('[StaffFinanceView] Loaded allShifts:', json.allShifts.length, json.allShifts);
                setAllShifts(json.allShifts);
            } else {
                console.warn('[StaffFinanceView] No allShifts in response:', json);
                setAllShifts([]);
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

    // Вычисляем общее количество закрытых смен
    const allClosedShiftsCount = useMemo(() => {
        if (!allShifts || allShifts.length === 0) return 0;
        return allShifts.filter((s) => s.status === 'closed').length;
    }, [allShifts]);

    // Вычисляем статистику в зависимости от выбранного периода
    const filteredStats = useMemo(() => {
        if (!allShifts || allShifts.length === 0) {
            return {
                totalAmount: 0,
                totalMaster: 0,
                totalSalon: 0,
                totalLateMinutes: 0,
                shiftsCount: 0,
            };
        }
        
        // Нормализуем shift_date - обрезаем время, если оно есть (формат YYYY-MM-DD)
        // PostgreSQL date тип возвращается как строка 'YYYY-MM-DD', но может быть и с временем
        const normalizedShifts = allShifts.map((s) => {
            let normalizedDate = String(s.shift_date || '');
            // Если есть время, обрезаем его
            normalizedDate = normalizedDate.split('T')[0].split(' ')[0].trim();
            return {
                ...s,
                shift_date: normalizedDate,
            };
        });
        
        const closedShifts = normalizedShifts.filter((s) => s.status === 'closed');
        
        let filtered: typeof closedShifts = [];
        
        if (statsPeriod === 'day') {
            const dayStr = formatInTimeZone(selectedDate, TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date === dayStr);
        } else if (statsPeriod === 'month') {
            const monthStart = formatInTimeZone(startOfMonth(selectedMonth), TZ, 'yyyy-MM-dd');
            const monthEnd = formatInTimeZone(endOfMonth(selectedMonth), TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= monthStart && s.shift_date <= monthEnd);
        } else if (statsPeriod === 'year') {
            const yearStart = formatInTimeZone(startOfYear(new Date(selectedYear, 0, 1)), TZ, 'yyyy-MM-dd');
            const yearEnd = formatInTimeZone(endOfYear(new Date(selectedYear, 11, 31)), TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= yearStart && s.shift_date <= yearEnd);
        } else {
            filtered = closedShifts;
        }
        
        const totalAmount = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        // Итоговая сумма сотрудника = гарантированная сумма (если есть и больше базовой доли) или базовая доля
        const totalMaster = filtered.reduce((sum, s) => {
            const guaranteed = Number(s.guaranteed_amount || 0);
            const masterShare = Number(s.master_share || 0);
            // Если есть гарантированная сумма и она больше базовой доли, используем гарантию
            // Иначе используем базовую долю
            return sum + (guaranteed > masterShare ? guaranteed : masterShare);
        }, 0);
        // Бизнес получает долю от выручки, но вычитает доплату владельца
        const totalSalon = filtered.reduce((sum, s) => {
            const salonShare = Number(s.salon_share || 0);
            const topup = Number(s.topup_amount || 0);
            return sum + salonShare - topup;
        }, 0);
        const totalLateMinutes = filtered.reduce((sum, s) => sum + Number(s.late_minutes || 0), 0);
        
        // Отладочная информация
        console.log('[StaffFinanceView] All shifts:', allShifts.length, 'Closed:', closedShifts.length, 'Filtered:', filtered.length);
        if (filtered.length > 0) {
            console.log('[StaffFinanceView] Filtered shifts with amounts:', filtered.map(s => ({
                shift_date: s.shift_date,
                total_amount: s.total_amount,
                master_share: s.master_share,
                salon_share: s.salon_share,
                late_minutes: s.late_minutes
            })));
            console.log('[StaffFinanceView] Calculated stats:', { totalAmount, totalMaster, totalSalon, totalLateMinutes });
            
            // Проверяем, все ли суммы равны 0
            if (totalAmount === 0 && totalMaster === 0 && totalSalon === 0) {
                console.warn('[StaffFinanceView] All amounts are 0! Check if shifts have valid data in database.');
                filtered.forEach(s => {
                    console.warn('[StaffFinanceView] Shift data:', {
                        shift_date: s.shift_date,
                        total_amount: s.total_amount,
                        master_share: s.master_share,
                        salon_share: s.salon_share,
                        raw_total_amount: s.total_amount,
                        raw_master_share: s.master_share,
                        raw_salon_share: s.salon_share
                    });
                });
            }
        } else if (closedShifts.length > 0) {
            console.log('[StaffFinanceView] No shifts match filter. Period:', statsPeriod);
            console.log('[StaffFinanceView] All closed shifts:', closedShifts.map(s => ({ 
                shift_date: s.shift_date, 
                total_amount: s.total_amount, 
                master_share: s.master_share,
                salon_share: s.salon_share
            })));
        }
        
        return {
            totalAmount,
            totalMaster,
            totalSalon,
            totalLateMinutes,
            shiftsCount: filtered.length,
        };
    }, [allShifts, statsPeriod, selectedDate, selectedMonth, selectedYear]);
    
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

    // Для закрытой смены используем сохранённые значения guaranteed_amount
    // Если есть гарантированная сумма, она и является итоговой суммой к получению
    // topup_amount - это доплата владельца (разница между гарантией и базовой долей)
    if (isClosed && todayShift) {
        const guaranteed = todayShift.guaranteed_amount ?? null;
        if (guaranteed !== null && guaranteed > 0) {
            // Итоговая сумма сотрудника = гарантированная сумма
            mShare = Math.round(guaranteed * 100) / 100;
            // Бизнес получает долю от выручки, но доплачивает разницу (topup_amount), если гарантия больше базовой доли
            const topup = todayShift.topup_amount ?? 0;
            // sShare = доля бизнеса от выручки - доплата владельца
            sShare = baseBizShare - topup;
        } else if (guaranteed !== null && guaranteed === 0) {
            // Если гарантированная сумма = 0, используем базовую долю
            mShare = baseStaffShare;
            sShare = baseBizShare;
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
                                                    {(todayShift.guaranteed_amount ?? 0).toFixed(2)} {t('staff.finance.shift.som', 'сом')}
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
                                        className={`group flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all ${isOpen && !isReadOnly ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                        onClick={() => isOpen && !isReadOnly && setExpandedItems((prev) => new Set(prev).add(idx))}
                                    >
                                        <div className="flex-1 grid grid-cols-[2fr,2fr,1fr,1fr] gap-4 items-center min-w-0">
                                            <div className="min-w-0">
                                                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {item.clientName || t('staff.finance.clients.notSpecified', 'Клиент не указан')}
                                                </div>
                                                {item.note && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={item.note}>
                                                        💬 {item.note}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-gray-700 dark:text-gray-300 truncate">
                                                    {item.serviceName || <span className="text-gray-400">—</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {(item.serviceAmount ?? 0) === 0 && !item.serviceName
                                                        ? <span className="text-gray-400">—</span>
                                                        : `${(item.serviceAmount ?? 0).toLocaleString('ru-RU')} ${t('staff.finance.shift.som', 'сом')}`}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {(item.consumablesAmount ?? 0) === 0
                                                        ? <span className="text-gray-400">0</span>
                                                        : `${(item.consumablesAmount ?? 0).toLocaleString('ru-RU')}`} {t('staff.finance.shift.som', 'сом')}
                                                </div>
                                            </div>
                                        </div>
                                        {isOpen && !isReadOnly && (
                                            <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedItems((prev) => new Set(prev).add(idx));
                                                    }}
                                                    title={t('staff.finance.clients.edit', 'Редактировать')}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(t('staff.finance.clients.confirmDelete', 'Удалить этого клиента?'))) {
                                                            setItems((prev) => prev.filter((_, i) => i !== idx));
                                                            setExpandedItems((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(idx);
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    title={t('staff.finance.clients.delete', 'Удалить')}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
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
                                    className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 shadow-md space-y-4"
                                >
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {t('staff.finance.clients.editing', 'Редактирование клиента')}
                                        </h3>
                                        <button
                                            type="button"
                                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                            onClick={() => setExpandedItems((prev) => {
                                                const next = new Set(prev);
                                                next.delete(idx);
                                                return next;
                                            })}
                                            title={t('staff.finance.clients.collapse', 'Свернуть')}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Левая колонка */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    {t('staff.finance.clients.client', 'Клиент')}
                                                </label>
                                                <select
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
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
                                                        const serviceLabel = service ? getServiceName(service) : '';
                                                        const time = formatInTimeZone(new Date(b.start_at), TZ, 'HH:mm');
                                                        return (
                                                            <option key={b.id} value={b.id}>
                                                                {clientLabel} - {serviceLabel} ({time})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {!item.bookingId && (
                                                    <div className="mt-2">
                                                        <input
                                                            type="text"
                                                            placeholder={t('staff.finance.clients.clientNamePlaceholder', 'Имя клиента (для клиентов «с улицы»)')}
                                                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
                                                            value={item.clientName}
                                                            onChange={(e) => {
                                                                setItems((prev) =>
                                                                    prev.map((it, i) =>
                                                                        i === idx ? { ...it, clientName: e.target.value } : it
                                                                    )
                                                                );
                                                            }}
                                                            disabled={!isOpen || isReadOnly}
                                                        />
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            {t('staff.finance.clients.walkInHint', 'Для клиентов «с улицы» введите имя вручную')}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    {t('staff.finance.clients.service', 'Услуга')}
                                                </label>
                                                <select
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
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
                                                    {serviceOptions.map((svc) => {
                                                        const displayName = getServiceName(svc);
                                                        const value = svc.name_ru;
                                                        return (
                                                            <option key={value} value={value}>
                                                                {displayName}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Правая колонка */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    {t('staff.finance.clients.servicePrice', 'Цена за услугу')}
                                                    <span className="text-gray-500 ml-1">(сом)</span>
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="50"
                                                        placeholder="0"
                                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-sm text-right font-medium text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
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
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                                        сом
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    {t('staff.finance.clients.consumablesAmount', 'Расходники')}
                                                    <span className="text-gray-500 ml-1">(сом)</span>
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="10"
                                                        placeholder="0"
                                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-8 text-sm text-right font-medium text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
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
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                                        сом
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    {t('staff.finance.clients.note', 'Комментарий')}
                                                    <span className="text-gray-400 font-normal ml-1">({t('staff.finance.clients.optional', 'необязательно')})</span>
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    placeholder={t('staff.finance.clients.notePlaceholder', 'Дополнительная информация...')}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none"
                                                    value={item.note || ''}
                                                    onChange={(e) => {
                                                        setItems((prev) =>
                                                            prev.map((it, i) =>
                                                                i === idx ? { ...it, note: e.target.value } : it
                                                            )
                                                        );
                                                    }}
                                                    disabled={!isOpen || isReadOnly}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isOpen && !isReadOnly && (
                                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                type="button"
                                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
                            {t('staff.finance.stats.totalShifts', 'Всего закрытых смен')}: {allClosedShiftsCount}
                        </div>
                    </div>
                    
                    {/* Фильтры по периодам */}
                    <div className="space-y-3">
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
                                onClick={() => setStatsPeriod('year')}
                                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                    statsPeriod === 'year'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {t('staff.finance.stats.period.year', 'Год')}
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
                        
                        {/* Фильтры для выбранного периода */}
                        {statsPeriod === 'day' && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('staff.finance.stats.selectDate', 'Выберите дату')}:
                                </label>
                                <DatePickerPopover
                                    value={formatInTimeZone(selectedDate, TZ, 'yyyy-MM-dd')}
                                    onChange={(dateStr) => {
                                        const [year, month, day] = dateStr.split('-').map(Number);
                                        setSelectedDate(new Date(year, month - 1, day));
                                    }}
                                    className="inline-block"
                                />
                            </div>
                        )}
                        
                        {statsPeriod === 'month' && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('staff.finance.stats.selectMonth', 'Выберите месяц')}:
                                </label>
                                <MonthPickerPopover
                                    value={formatInTimeZone(selectedMonth, TZ, 'yyyy-MM-dd')}
                                    onChange={(dateStr) => {
                                        const [year, month] = dateStr.split('-').map(Number);
                                        setSelectedMonth(new Date(year, month - 1, 1));
                                    }}
                                    className="inline-block"
                                />
                            </div>
                        )}
                        
                        {statsPeriod === 'year' && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('staff.finance.stats.selectYear', 'Выберите год')}:
                                </label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    {Array.from({ length: 10 }, (_, i) => {
                                        const year = new Date().getFullYear() - 5 + i;
                                        return (
                                            <option key={year} value={year}>
                                                {year}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}
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


