// apps/web/src/app/staff/finance/hooks/useShiftData.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import type { TodayResponse, ShiftItem, Booking, ServiceName } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';


interface UseShiftDataOptions {
    staffId?: string;
    shiftDate: Date;
    onDataLoaded?: () => void;
}

interface UseShiftDataReturn {
    loading: boolean;
    today: TodayResponse | null;
    items: ShiftItem[];
    bookings: Booking[];
    availableServices: ServiceName[];
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
    allShifts: Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }>;
    load: (date?: Date) => Promise<void>;
    isInitialLoad: boolean;
}

/**
 * Хук для загрузки данных смены
 */
export function useShiftData({ staffId, shiftDate, onDataLoaded }: UseShiftDataOptions): UseShiftDataReturn {
    const { t } = useLanguage();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState<TodayResponse | null>(null);
    const [items, setItems] = useState<ShiftItem[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [availableServices, setAvailableServices] = useState<ServiceName[]>([]);
    const [staffPercentMaster, setStaffPercentMaster] = useState(60);
    const [staffPercentSalon, setStaffPercentSalon] = useState(40);
    const [hourlyRate, setHourlyRate] = useState<number | null>(null);
    const [currentHoursWorked, setCurrentHoursWorked] = useState<number | null>(null);
    const [currentGuaranteedAmount, setCurrentGuaranteedAmount] = useState<number | null>(null);
    const [isDayOff, setIsDayOff] = useState(false);
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
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const load = async (date?: Date) => {
        setLoading(true);
        try {
            // Используем переданную дату или текущую дату для смены
            const targetDate = date || shiftDate;
            const dateStr = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
            
            // Если передан staffId, используем endpoint для владельца бизнеса
            const apiUrl = staffId 
                ? `/api/dashboard/staff/${staffId}/finance?date=${dateStr}`
                : '/api/staff/shift/today';
            const res = await fetch(apiUrl, { cache: 'no-store' });
            const json: TodayResponse = await res.json();
            setToday(json);
            
            if (json.ok && json.today.exists && json.today.shift) {
                const loadedItems = (json.today.items ?? []).map((it: {
                    id?: string;
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    service_amount?: number;
                    amount?: number;
                    consumablesAmount?: number;
                    consumables_amount?: number;
                    bookingId?: string | null;
                    booking_id?: string | null;
                    createdAt?: string | null;
                    created_at?: string | null;
                }) => ({
                    id: it.id,
                    clientName: it.clientName ?? it.client_name ?? '',
                    serviceName: it.serviceName ?? it.service_name ?? '',
                    serviceAmount:
                        Number(
                            it.service_amount ??
                                it.serviceAmount ??
                                it.amount ??
                                0
                        ) || 0,
                    consumablesAmount:
                        Number(
                            it.consumables_amount ??
                                it.consumablesAmount ??
                                0
                        ) || 0,
                    bookingId: it.bookingId ?? it.booking_id ?? null,
                    createdAt: it.createdAt ?? it.created_at ?? null,
                }))
                .sort((a, b) => {
                    if (!a.createdAt && !b.createdAt) return 0;
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
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
                const services = json.services.map((svc: string | ServiceName) => {
                    if (typeof svc === 'string') {
                        return { name_ru: svc };
                    }
                    return svc;
                });
                setAvailableServices(services);
            }
            
            // Проценты из настроек сотрудника
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
                setAllShifts(json.allShifts);
            } else {
                setAllShifts([]);
            }
        } catch (e) {
            let errorMessage = t('staff.finance.error.loading', 'Не удалось загрузить данные смены');
            
            if (e instanceof TypeError && e.message.includes('fetch')) {
                errorMessage = t('staff.finance.error.loading.network', 'Ошибка сети. Проверьте подключение к интернету.');
            } else if (e instanceof Error) {
                errorMessage = e.message;
            }
            
            setToday({ ok: false, error: errorMessage });
            toast.showError(errorMessage);
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
            onDataLoaded?.();
        }
    };

    useEffect(() => {
        void load();
    }, []);

    // Перезагружаем данные при изменении даты смены (только для владельца)
    useEffect(() => {
        if (!isInitialLoad && staffId) {
            void load(shiftDate);
        }
    }, [shiftDate, staffId, isInitialLoad]);

    return {
        loading,
        today,
        items,
        bookings,
        availableServices,
        staffPercentMaster,
        staffPercentSalon,
        hourlyRate,
        currentHoursWorked,
        currentGuaranteedAmount,
        isDayOff,
        allShifts,
        load,
        isInitialLoad,
    };
}

