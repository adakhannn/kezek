// apps/web/src/app/staff/finance/hooks/useShiftData.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState, useCallback, useRef } from 'react';

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
    
    // Сохраняем t и toast в ref, чтобы избежать пересоздания load
    const tRef = useRef(t);
    const toastRef = useRef(toast);
    useEffect(() => {
        tRef.current = t;
        toastRef.current = toast;
    }, [t, toast]);
    
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
    
    // Сохраняем callback в ref, чтобы избежать пересоздания load
    const onDataLoadedRef = useRef(onDataLoaded);
    useEffect(() => {
        onDataLoadedRef.current = onDataLoaded;
    }, [onDataLoaded]);
    
    // AbortController для отмены предыдущих запросов при новом запросе
    const abortControllerRef = useRef<AbortController | null>(null);
    // Отслеживаем последний запрошенный dateStr, чтобы игнорировать устаревшие ответы
    const lastRequestedDateRef = useRef<string | null>(null);
    // Отслеживаем текущий запрос, чтобы предотвратить дублирующиеся запросы
    const currentRequestRef = useRef<{ dateStr: string; promise: Promise<void> } | null>(null);
    // Простой кэш для предотвращения повторных запросов с той же датой
    const cacheRef = useRef<Map<string, { data: TodayResponse; timestamp: number }>>(new Map());
    const CACHE_TTL = 5000; // 5 секунд кэш

    const load = useCallback(async (date?: Date) => {
        // Используем переданную дату или текущую дату для смены из ref
        const targetDate = date || shiftDateRef.current;
        const dateStr = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
        
        // Проверяем кэш перед запросом
        const cached = cacheRef.current.get(dateStr);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            // Используем кэшированные данные
            if (lastRequestedDateRef.current === dateStr) {
                setToday(cached.data);
                // Восстанавливаем данные из кэша
                if (cached.data.ok && cached.data.today.exists && cached.data.today.shift) {
                    const itemsArray = Array.isArray(cached.data.today.items) ? cached.data.today.items : [];
                    type ApiShiftItem = {
                        id?: string | null;
                        clientName?: string | null;
                        client_name?: string | null;
                        serviceName?: string | null;
                        service_name?: string | null;
                        serviceAmount?: number | null;
                        service_amount?: number | null;
                        amount?: number | null;
                        consumablesAmount?: number | null;
                        consumables_amount?: number | null;
                        bookingId?: string | null;
                        booking_id?: string | null;
                        createdAt?: string | null;
                        created_at?: string | null;
                    };
                    setItems(itemsArray.map((it: ApiShiftItem): ShiftItem => ({
                        id: it.id && typeof it.id === 'string' ? it.id : undefined,
                        clientName: (it.clientName ?? it.client_name ?? '') || '',
                        serviceName: (it.serviceName ?? it.service_name ?? '') || '',
                        serviceAmount: Number(it.service_amount ?? it.serviceAmount ?? it.amount ?? 0) || 0,
                        consumablesAmount: Number(it.consumables_amount ?? it.consumablesAmount ?? 0) || 0,
                        bookingId: (it.bookingId ?? it.booking_id) && typeof (it.bookingId ?? it.booking_id) === 'string'
                            ? (it.bookingId ?? it.booking_id)
                            : null,
                        createdAt: (it.createdAt ?? it.created_at) && typeof (it.createdAt ?? it.created_at) === 'string'
                            ? (it.createdAt ?? it.created_at)
                            : null,
                    })));
                } else {
                    setItems([]);
                }
                if (cached.data.ok && 'bookings' in cached.data && Array.isArray(cached.data.bookings)) {
                    setBookings(cached.data.bookings.filter((b): b is Booking => 
                        b !== null && 
                        typeof b === 'object' && 
                        'id' in b && 
                        typeof b.id === 'string' &&
                        'start_at' in b &&
                        typeof b.start_at === 'string'
                    ));
                }
                if (cached.data.ok && 'services' in cached.data && Array.isArray(cached.data.services)) {
                    setAvailableServices(cached.data.services.map((svc: string | ServiceName): ServiceName => {
                        if (typeof svc === 'string') {
                            return { name_ru: svc };
                        }
                        return {
                            name_ru: svc.name_ru || '',
                            name_ky: (svc.name_ky && typeof svc.name_ky === 'string') ? svc.name_ky : null,
                            name_en: (svc.name_en && typeof svc.name_en === 'string') ? svc.name_en : null,
                        };
                    }));
                }
                if (cached.data.ok && 'staffPercentMaster' in cached.data && 'staffPercentSalon' in cached.data) {
                    setStaffPercentMaster(Number(cached.data.staffPercentMaster ?? 60));
                    setStaffPercentSalon(Number(cached.data.staffPercentSalon ?? 40));
                }
                if (cached.data.ok && 'isDayOff' in cached.data) {
                    setIsDayOff(Boolean(cached.data.isDayOff));
                }
                if (cached.data.ok && 'hourlyRate' in cached.data) {
                    setHourlyRate(cached.data.hourlyRate ?? null);
                }
                if (cached.data.ok && 'currentHoursWorked' in cached.data) {
                    setCurrentHoursWorked(cached.data.currentHoursWorked ?? null);
                }
                if (cached.data.ok && 'currentGuaranteedAmount' in cached.data) {
                    setCurrentGuaranteedAmount(cached.data.currentGuaranteedAmount ?? null);
                }
                if (cached.data.ok && 'allShifts' in cached.data && Array.isArray(cached.data.allShifts)) {
                    setAllShifts(cached.data.allShifts);
                } else {
                    setAllShifts([]);
                }
                setLoading(false);
                setIsInitialLoad(false);
                onDataLoadedRef.current?.();
            }
            return;
        }
        
        // Проверяем, не идет ли уже запрос с той же датой
        if (currentRequestRef.current && currentRequestRef.current.dateStr === dateStr) {
            // Ждем завершения текущего запроса
            try {
                await currentRequestRef.current.promise;
            } catch {
                // Игнорируем ошибки из предыдущего запроса
            }
            // Проверяем кэш еще раз после завершения запроса
            const cachedAfterWait = cacheRef.current.get(dateStr);
            if (cachedAfterWait && Date.now() - cachedAfterWait.timestamp < CACHE_TTL) {
                if (lastRequestedDateRef.current === dateStr) {
                    setToday(cachedAfterWait.data);
                    setLoading(false);
                    setIsInitialLoad(false);
                    onDataLoadedRef.current?.();
                }
                return;
            }
        }
        
        // Отменяем предыдущий запрос, если он еще выполняется
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Создаем новый AbortController для этого запроса
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Сохраняем дату текущего запроса
        lastRequestedDateRef.current = dateStr;

        setLoading(true);
        
        // Создаем промис для текущего запроса
        const requestPromise = (async () => {
            try {
                // Если передан staffId, используем endpoint для владельца бизнеса
                const apiUrl = staffId 
                    ? `/api/dashboard/staff/${staffId}/finance?date=${dateStr}`
                    : '/api/staff/shift/today';
                
                const res = await fetch(apiUrl, { 
                    cache: 'no-store',
                    signal: abortController.signal 
                });
            
            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
                return;
            }
            
            // Проверяем, не устарел ли запрос (если был запрошен другой dateStr)
            if (lastRequestedDateRef.current !== dateStr) {
                return;
            }
            
            // Проверяем HTTP статус перед парсингом JSON
            if (!res.ok) {
                let errorMessage = tRef.current('staff.finance.error.loading', 'Не удалось загрузить данные смены');
                let errorDetails: string | undefined;
                
                // Пытаемся получить сообщение об ошибке из ответа
                try {
                    const errorJson = await res.json();
                    if (errorJson?.error) {
                        errorMessage = errorJson.error;
                    } else if (errorJson?.message) {
                        errorMessage = errorJson.message;
                    }
                    // Дополнительные детали об ошибке, если есть
                    if (errorJson?.details) {
                        errorDetails = errorJson.details;
                    }
                } catch {
                    // Если не удалось распарсить JSON, используем стандартные сообщения по статусу
                }
                
                // Улучшенные сообщения для разных HTTP статусов с более понятными формулировками
                if (res.status === 404) {
                    errorMessage = staffId 
                        ? tRef.current('staff.finance.error.notFound', 'Сотрудник или данные смены не найдены. Проверьте правильность выбранной даты.')
                        : tRef.current('staff.finance.error.shiftNotFound', 'Смена не найдена. Возможно, смена еще не была открыта.');
                } else if (res.status === 401) {
                    errorMessage = tRef.current('staff.finance.error.unauthorized', 'Сессия истекла. Пожалуйста, войдите в систему снова.');
                } else if (res.status === 403) {
                    errorMessage = tRef.current('staff.finance.error.forbidden', 'У вас нет доступа к этой информации. Обратитесь к администратору.');
                } else if (res.status === 400) {
                    errorMessage = errorMessage || tRef.current('staff.finance.error.badRequest', 'Некорректный запрос. Проверьте выбранную дату и попробуйте снова.');
                } else if (res.status === 429) {
                    errorMessage = tRef.current('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                } else if (res.status >= 500) {
                    errorMessage = tRef.current('staff.finance.error.server', 'Временная ошибка сервера. Пожалуйста, попробуйте через несколько секунд.');
                } else if (res.status >= 400) {
                    errorMessage = errorMessage || tRef.current('staff.finance.error.client', 'Ошибка при загрузке данных. Проверьте подключение к интернету и попробуйте снова.');
                }
                
                // Добавляем детали, если они есть
                if (errorDetails) {
                    errorMessage = `${errorMessage} ${errorDetails}`;
                }
                
                // Проверяем актуальность перед установкой ошибки
                if (lastRequestedDateRef.current === dateStr) {
                    setToday({ ok: false, error: errorMessage });
                    toastRef.current.showError(errorMessage);
                }
                return;
            }
            
            // Парсим JSON ответ
            let json: TodayResponse;
            try {
                json = await res.json();
            } catch {
                // Проверяем актуальность перед установкой ошибки парсинга
                if (lastRequestedDateRef.current === dateStr) {
                    const errorMessage = tRef.current('staff.finance.error.parse', 'Ошибка обработки ответа сервера');
                    setToday({ ok: false, error: errorMessage });
                    toastRef.current.showError(errorMessage);
                }
                return;
            }
            
            // Проверяем, не был ли запрос отменен или устарел
            if (abortController.signal.aborted || lastRequestedDateRef.current !== dateStr) {
                return;
            }
            
            // Проверяем, что ответ содержит ok: false
            if (!json.ok) {
                // Проверяем актуальность перед установкой ошибки
                if (lastRequestedDateRef.current !== dateStr) {
                    return;
                }
                const errorMessage = json.error || tRef.current('staff.finance.error.loading', 'Не удалось загрузить данные смены');
                setToday({ ok: false, error: errorMessage });
                toastRef.current.showError(errorMessage);
                return;
            }
            
            // Проверяем актуальность перед установкой данных
            if (lastRequestedDateRef.current !== dateStr) {
                return;
            }
            
            setToday(json);
            
            if (json.ok && json.today.exists && json.today.shift) {
                // Тип для элемента смены из API (может быть в разных форматах)
                type ApiShiftItem = {
                    id?: string | null;
                    clientName?: string | null;
                    client_name?: string | null;
                    serviceName?: string | null;
                    service_name?: string | null;
                    serviceAmount?: number | null;
                    service_amount?: number | null;
                    amount?: number | null;
                    consumablesAmount?: number | null;
                    consumables_amount?: number | null;
                    bookingId?: string | null;
                    booking_id?: string | null;
                    createdAt?: string | null;
                    created_at?: string | null;
                };
                
                const itemsArray = Array.isArray(json.today.items) ? json.today.items : [];
                const loadedItems = itemsArray.map((it: ApiShiftItem): ShiftItem => {
                    // Безопасное извлечение значений с проверками на null/undefined
                    const id = it.id && typeof it.id === 'string' ? it.id : undefined;
                    const clientName = (it.clientName ?? it.client_name ?? '') || '';
                    const serviceName = (it.serviceName ?? it.service_name ?? '') || '';
                    
                    // Безопасное преобразование чисел
                    const serviceAmount = Number(
                        it.service_amount ?? it.serviceAmount ?? it.amount ?? 0
                    ) || 0;
                    const consumablesAmount = Number(
                        it.consumables_amount ?? it.consumablesAmount ?? 0
                    ) || 0;
                    
                    // Безопасное извлечение bookingId и createdAt
                    const bookingId = (it.bookingId ?? it.booking_id) && typeof (it.bookingId ?? it.booking_id) === 'string'
                        ? (it.bookingId ?? it.booking_id)
                        : null;
                    const createdAt = (it.createdAt ?? it.created_at) && typeof (it.createdAt ?? it.created_at) === 'string'
                        ? (it.createdAt ?? it.created_at)
                        : null;
                    
                    return {
                        id,
                        clientName,
                        serviceName,
                        serviceAmount,
                        consumablesAmount,
                        bookingId,
                        createdAt,
                    };
                })
                .sort((a, b) => {
                    // Сначала сортируем по createdAt (новые сверху)
                    if (!a.createdAt && !b.createdAt) {
                        // Если оба без времени, сортируем по id (для стабильности)
                        if (!a.id && !b.id) return 0;
                        if (!a.id) return 1;
                        if (!b.id) return -1;
                        return b.id.localeCompare(a.id);
                    }
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    // Если время одинаковое (в пределах 1 секунды), сортируем по id
                    if (Math.abs(timeDiff) < 1000) {
                        if (!a.id && !b.id) return 0;
                        if (!a.id) return 1;
                        if (!b.id) return -1;
                        return b.id.localeCompare(a.id);
                    }
                    return timeDiff;
                });
                // Проверяем актуальность перед установкой items
                if (lastRequestedDateRef.current === dateStr) {
                    setItems(loadedItems);
                }
            } else {
                // Проверяем актуальность перед установкой пустого массива
                if (lastRequestedDateRef.current === dateStr) {
                    setItems([]);
                }
            }
            
            // Проверяем актуальность перед установкой остальных данных
            if (lastRequestedDateRef.current !== dateStr) {
                return;
            }
            
            // Записи за сегодня для выбора клиентов
            if (json.ok && 'bookings' in json && Array.isArray(json.bookings)) {
                // Типизируем bookings и проверяем на null/undefined
                const bookingsArray = json.bookings.filter((b): b is Booking => 
                    b !== null && 
                    typeof b === 'object' && 
                    'id' in b && 
                    typeof b.id === 'string' &&
                    'start_at' in b &&
                    typeof b.start_at === 'string'
                );
                setBookings(bookingsArray);
            }
            
            // Услуги сотрудника для выпадающего списка
            if (json.ok && 'services' in json && Array.isArray(json.services)) {
                const services = json.services
                    .filter((svc): svc is string | ServiceName => 
                        svc !== null && 
                        svc !== undefined &&
                        (typeof svc === 'string' || (typeof svc === 'object' && 'name_ru' in svc && typeof svc.name_ru === 'string'))
                    )
                    .map((svc: string | ServiceName): ServiceName => {
                        if (typeof svc === 'string') {
                            return { name_ru: svc };
                        }
                        // Проверяем, что это валидный ServiceName
                        if (svc && typeof svc === 'object' && 'name_ru' in svc && typeof svc.name_ru === 'string') {
                            return {
                                name_ru: svc.name_ru,
                                name_ky: (svc.name_ky && typeof svc.name_ky === 'string') ? svc.name_ky : null,
                                name_en: (svc.name_en && typeof svc.name_en === 'string') ? svc.name_en : null,
                            };
                        }
                        // Fallback (не должно произойти из-за фильтра выше)
                        return { name_ru: String(svc) };
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
            
            // Сохраняем успешный ответ в кэш
            if (json.ok && lastRequestedDateRef.current === dateStr) {
                cacheRef.current.set(dateStr, {
                    data: json,
                    timestamp: Date.now()
                });
                // Очищаем старые записи из кэша (оставляем только последние 10)
                if (cacheRef.current.size > 10) {
                    const entries = Array.from(cacheRef.current.entries());
                    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
                    cacheRef.current.clear();
                    entries.slice(0, 10).forEach(([key, value]) => {
                        cacheRef.current.set(key, value);
                    });
                }
            }
        } catch (e) {
            // Игнорируем ошибки отмены запроса (AbortError)
            if (e instanceof Error && e.name === 'AbortError') {
                return;
            }
            
            // Проверяем, не устарел ли запрос
            if (lastRequestedDateRef.current !== dateStr) {
                return;
            }
            
            let errorMessage = tRef.current('staff.finance.error.loading', 'Не удалось загрузить данные смены');
            
            // Обработка различных типов ошибок с более понятными сообщениями
            if (e instanceof TypeError) {
                if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
                    errorMessage = tRef.current('staff.finance.error.loading.network', 'Ошибка подключения к серверу. Проверьте подключение к интернету и попробуйте снова.');
                } else if (e.message.includes('JSON') || e.message.includes('parse')) {
                    errorMessage = tRef.current('staff.finance.error.parse', 'Ошибка обработки данных с сервера. Попробуйте обновить страницу.');
                } else {
                    errorMessage = tRef.current('staff.finance.error.unknown', 'Произошла неожиданная ошибка. Попробуйте обновить страницу.');
                }
            } else if (e instanceof DOMException && e.name === 'AbortError') {
                // Игнорируем ошибки отмены запроса
                return;
            } else if (e instanceof Error) {
                // Используем сообщение об ошибке, если оно есть, но делаем его более понятным
                if (e.message) {
                    // Если сообщение уже понятное, используем его, иначе добавляем контекст
                    if (e.message.length > 50 || e.message.includes('http') || e.message.includes('network')) {
                        errorMessage = e.message;
                    } else {
                        errorMessage = tRef.current('staff.finance.error.loading', 'Не удалось загрузить данные смены') + `: ${e.message}`;
                    }
                } else {
                    errorMessage = tRef.current('staff.finance.error.unknown', 'Произошла неожиданная ошибка. Попробуйте обновить страницу.');
                }
            } else {
                // Для неизвестных типов ошибок
                errorMessage = tRef.current('staff.finance.error.unknown', 'Произошла неожиданная ошибка. Попробуйте обновить страницу.');
            }
            
            setToday({ ok: false, error: errorMessage });
            toastRef.current.showError(errorMessage);
        } finally {
            // Очищаем AbortController только если это был последний запрос
            if (abortControllerRef.current === abortController && lastRequestedDateRef.current === dateStr) {
                abortControllerRef.current = null;
                setLoading(false);
                setIsInitialLoad(false);
                onDataLoadedRef.current?.();
            }
            // Очищаем ссылку на текущий запрос
            if (currentRequestRef.current && currentRequestRef.current.dateStr === dateStr) {
                currentRequestRef.current = null;
            }
        }
        })();
        
        // Сохраняем промис текущего запроса
        currentRequestRef.current = { dateStr, promise: requestPromise };
        
        // Ждем завершения запроса
        await requestPromise;
    }, [staffId]);

    // Используем строковое представление даты для зависимостей, чтобы избежать пересоздания объекта Date
    const shiftDateStr = formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd');
    
    // Сохраняем shiftDate в ref, чтобы использовать актуальное значение без пересоздания load
    const shiftDateRef = useRef(shiftDate);
    useEffect(() => {
        shiftDateRef.current = shiftDate;
    }, [shiftDate]);
    
    useEffect(() => {
        void load();
    }, []);

    // Перезагружаем данные при изменении даты смены (только для владельца)
    // Используем только shiftDateStr в зависимостях, чтобы избежать пересоздания объекта Date
    // Используем debounce для предотвращения множественных запросов при быстрой смене даты
    useEffect(() => {
        if (!isInitialLoad && staffId) {
            // Небольшая задержка для debounce - если дата изменится снова, предыдущий запрос будет отменен
            const timeoutId = setTimeout(() => {
                // Проверяем, что дата все еще актуальна перед загрузкой
                const currentDateStr = formatInTimeZone(shiftDateRef.current, TZ, 'yyyy-MM-dd');
                if (currentDateStr === shiftDateStr) {
                    void load(shiftDateRef.current);
                }
            }, 150); // 150ms debounce
            
            return () => {
                clearTimeout(timeoutId);
            };
        }
    }, [shiftDateStr, staffId, isInitialLoad, load]);

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

