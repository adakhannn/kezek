// apps/web/src/app/staff/finance/hooks/useShiftData.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState, useCallback, useRef } from 'react';

import type { TodayResponse, ShiftItem, Booking, ServiceName } from '../types';
import { fetchWithRetry, isNetworkError, isAbortError } from '../utils/networkRetry';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { logError } from '@/lib/log';
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
    load: (date?: Date, force?: boolean) => Promise<void>;
    invalidateCache: (date?: Date) => void;
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
    // Счетчик запросов для более надежной проверки актуальности (увеличивается при каждом новом запросе)
    const requestCounterRef = useRef<number>(0);
    // Отслеживаем текущий запрос, чтобы предотвратить дублирующиеся запросы
    const currentRequestRef = useRef<{ dateStr: string; requestId: number; promise: Promise<void> } | null>(null);
    // Флаг для отслеживания первой загрузки, чтобы предотвратить множественные запросы
    const initialLoadStartedRef = useRef<boolean>(false);
    // Система кэширования с разными TTL для разных типов данных
    interface CacheEntry {
        data: TodayResponse;
        timestamp: number;
        // Раздельное кэширование для разных частей данных
        staticDataTimestamp?: number; // Услуги, настройки сотрудника
        bookingsTimestamp?: number; // Записи
        shiftDataTimestamp?: number; // Данные смены и клиенты
        allShiftsTimestamp?: number; // Все смены для статистики
    }
    
    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
    
    // Разные TTL для разных типов данных
    const CACHE_TTL_STATIC = 5 * 60 * 1000; // 5 минут для статических данных (услуги, настройки)
    const CACHE_TTL_BOOKINGS = 30 * 1000; // 30 секунд для записей (bookings)
    const CACHE_TTL_SHIFT = 10 * 1000; // 10 секунд для данных смены и клиентов
    const CACHE_TTL_ALL_SHIFTS = 60 * 1000; // 1 минута для всех смен (статистика)

    const load = useCallback(async (date?: Date, force?: boolean) => {
        // Используем переданную дату или текущую дату для смены из ref
        const targetDate = date || shiftDateRef.current;
        const dateStr = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
        
        // Увеличиваем счетчик запросов для этого нового запроса
        const currentRequestId = ++requestCounterRef.current;
        
        // Проверяем, не идет ли уже запрос с той же датой (если не принудительная загрузка)
        if (!force && currentRequestRef.current && currentRequestRef.current.dateStr === dateStr) {
            // Ждем завершения текущего запроса
            try {
                await currentRequestRef.current.promise;
            } catch {
                // Игнорируем ошибки из предыдущего запроса
            }
            // Проверяем, не был ли запрошен новый запрос пока мы ждали
            if (requestCounterRef.current !== currentRequestId) {
                // Был запрошен новый запрос, игнорируем этот
                return;
            }
            // Проверяем кэш еще раз после завершения запроса
            const cachedAfterWait = cacheRef.current.get(dateStr);
            const nowAfterWait = Date.now();
            const staticDataValidAfterWait = cachedAfterWait && cachedAfterWait.staticDataTimestamp && (nowAfterWait - cachedAfterWait.staticDataTimestamp < CACHE_TTL_STATIC);
            const bookingsValidAfterWait = cachedAfterWait && cachedAfterWait.bookingsTimestamp && (nowAfterWait - cachedAfterWait.bookingsTimestamp < CACHE_TTL_BOOKINGS);
            const shiftDataValidAfterWait = cachedAfterWait && cachedAfterWait.shiftDataTimestamp && (nowAfterWait - cachedAfterWait.shiftDataTimestamp < CACHE_TTL_SHIFT);
            const allShiftsValidAfterWait = cachedAfterWait && cachedAfterWait.allShiftsTimestamp && (nowAfterWait - cachedAfterWait.allShiftsTimestamp < CACHE_TTL_ALL_SHIFTS);
            
            if (cachedAfterWait && staticDataValidAfterWait && bookingsValidAfterWait && shiftDataValidAfterWait && allShiftsValidAfterWait) {
                // Проверяем актуальность перед использованием кэша
                if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                    setToday(cachedAfterWait.data);
                    setLoading(false);
                    setIsInitialLoad(false);
                    onDataLoadedRef.current?.();
                }
                return;
            }
        }
        
        // Проверяем кэш перед запросом (если не принудительная загрузка)
        if (!force) {
            const cached = cacheRef.current.get(dateStr);
            const now = Date.now();
            
            // Проверяем, какие части данных еще актуальны в кэше
            const staticDataValid = cached && cached.staticDataTimestamp && (now - cached.staticDataTimestamp < CACHE_TTL_STATIC);
            const bookingsValid = cached && cached.bookingsTimestamp && (now - cached.bookingsTimestamp < CACHE_TTL_BOOKINGS);
            const shiftDataValid = cached && cached.shiftDataTimestamp && (now - cached.shiftDataTimestamp < CACHE_TTL_SHIFT);
            const allShiftsValid = cached && cached.allShiftsTimestamp && (now - cached.allShiftsTimestamp < CACHE_TTL_ALL_SHIFTS);
            
            // Если все данные актуальны, используем кэш полностью
            if (cached && staticDataValid && bookingsValid && shiftDataValid && allShiftsValid) {
                // Используем кэшированные данные (проверяем актуальность через requestId)
                if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
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
            }
            return;
        }
        
        // Проверяем, не идет ли уже запрос с той же датой
        // (currentRequestId уже определен выше)
        if (currentRequestRef.current && currentRequestRef.current.dateStr === dateStr) {
            // Ждем завершения текущего запроса
            try {
                await currentRequestRef.current.promise;
            } catch {
                // Игнорируем ошибки из предыдущего запроса
            }
            // Проверяем, не был ли запрошен новый запрос пока мы ждали
            if (requestCounterRef.current !== currentRequestId) {
                // Был запрошен новый запрос, игнорируем этот
                return;
            }
            // Проверяем кэш еще раз после завершения запроса
            const cachedAfterWait = cacheRef.current.get(dateStr);
            const nowAfterWait = Date.now();
            const staticDataValidAfterWait = cachedAfterWait && cachedAfterWait.staticDataTimestamp && (nowAfterWait - cachedAfterWait.staticDataTimestamp < CACHE_TTL_STATIC);
            const bookingsValidAfterWait = cachedAfterWait && cachedAfterWait.bookingsTimestamp && (nowAfterWait - cachedAfterWait.bookingsTimestamp < CACHE_TTL_BOOKINGS);
            const shiftDataValidAfterWait = cachedAfterWait && cachedAfterWait.shiftDataTimestamp && (nowAfterWait - cachedAfterWait.shiftDataTimestamp < CACHE_TTL_SHIFT);
            const allShiftsValidAfterWait = cachedAfterWait && cachedAfterWait.allShiftsTimestamp && (nowAfterWait - cachedAfterWait.allShiftsTimestamp < CACHE_TTL_ALL_SHIFTS);
            
            if (cachedAfterWait && staticDataValidAfterWait && bookingsValidAfterWait && shiftDataValidAfterWait && allShiftsValidAfterWait) {
                // Проверяем актуальность перед использованием кэша
                if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
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
                // Используем единый endpoint для обоих случаев
                const apiUrl = staffId 
                    ? `/api/staff/finance?staffId=${encodeURIComponent(staffId)}&date=${dateStr}`
                    : `/api/staff/finance?date=${dateStr}`;
                
                // Используем fetchWithRetry для автоматических повторных попыток при сетевых ошибках
                const res = await fetchWithRetry(
                    apiUrl,
                    { 
                        cache: 'no-store',
                        signal: abortController.signal 
                    },
                    {
                        retries: 3,
                        baseDelayMs: 1000,
                        maxDelayMs: 10000,
                        scope: 'ShiftData'
                    }
                );
                
                // Проверяем, не был ли запрос отменен
                if (abortController.signal.aborted) {
                    return;
                }
                
                // Проверяем актуальность запроса: дата и счетчик должны совпадать
                if (lastRequestedDateRef.current !== dateStr || requestCounterRef.current !== currentRequestId) {
                    // Запрос устарел - был запрошен новый запрос
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
                    if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
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
                    if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                        const errorMessage = tRef.current('staff.finance.error.parse', 'Ошибка обработки ответа сервера');
                        setToday({ ok: false, error: errorMessage });
                        toastRef.current.showError(errorMessage);
                    }
                    return;
                }
                
                // Проверяем актуальность запроса: дата и счетчик должны совпадать
                if (abortController.signal.aborted || 
                    lastRequestedDateRef.current !== dateStr || 
                    requestCounterRef.current !== currentRequestId) {
                    // Запрос устарел - был запрошен новый запрос
                    return;
                }
                
                // Проверяем, что ответ содержит ok: false
                if (!json.ok) {
                    // Проверяем актуальность перед установкой ошибки
                    if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                        const errorMessage = json.error || tRef.current('staff.finance.error.loading', 'Не удалось загрузить данные смены');
                        setToday({ ok: false, error: errorMessage });
                        toastRef.current.showError(errorMessage);
                    }
                    return;
                }
                
                // Проверяем актуальность перед установкой данных
                if (lastRequestedDateRef.current !== dateStr || requestCounterRef.current !== currentRequestId) {
                    // Запрос устарел - был запрошен новый запрос
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
                    if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                        setItems(loadedItems);
                    }
                } else {
                    // Проверяем актуальность перед установкой пустого массива
                    if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                        setItems([]);
                    }
                }
                
                // Проверяем актуальность перед установкой остальных данных
                if (lastRequestedDateRef.current !== dateStr || requestCounterRef.current !== currentRequestId) {
                    // Запрос устарел - был запрошен новый запрос
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
                
                // Сохраняем успешный ответ в кэш (только если запрос актуален)
                if (json.ok && 
                    lastRequestedDateRef.current === dateStr && 
                    requestCounterRef.current === currentRequestId) {
                    const cacheTimestamp = Date.now();
                    
                    // Получаем существующую запись кэша или создаем новую
                    const existingCache = cacheRef.current.get(dateStr);
                    const cacheEntry: CacheEntry = {
                        data: json,
                        timestamp: cacheTimestamp,
                        // Обновляем timestamp только для тех частей данных, которые были загружены
                        // Для статических данных используем существующий timestamp, если он еще актуален
                        staticDataTimestamp: existingCache?.staticDataTimestamp && 
                            (cacheTimestamp - existingCache.staticDataTimestamp < CACHE_TTL_STATIC)
                            ? existingCache.staticDataTimestamp 
                            : cacheTimestamp,
                        bookingsTimestamp: cacheTimestamp, // Bookings всегда обновляем
                        shiftDataTimestamp: cacheTimestamp, // Данные смены всегда обновляем
                        allShiftsTimestamp: cacheTimestamp, // Все смены всегда обновляем
                    };
                    
                    cacheRef.current.set(dateStr, cacheEntry);
                    
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
                
                // Игнорируем ошибки отмены запроса (AbortError)
                if (isAbortError(e)) {
                    return;
                }
                
                // Проверяем актуальность запроса: дата и счетчик должны совпадать
                if (lastRequestedDateRef.current !== dateStr || requestCounterRef.current !== currentRequestId) {
                    // Запрос устарел - был запрошен новый запрос, игнорируем эту ошибку
                    return;
                }
                
                let errorMessage: string;
                
                // Обработка различных типов ошибок с более понятными сообщениями
                if (e instanceof Error && e.name === 'RateLimitError') {
                    // Ошибка rate limiting
                    errorMessage = e.message || tRef.current('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                    toastRef.current.showWarning(errorMessage);
                    logError('ShiftData', 'Rate limit exceeded', e);
                } else if (isNetworkError(e)) {
                    // Сетевые ошибки (например, нет интернета, таймаут, недоступен сервер)
                    // fetchWithRetry уже попытался повторить запрос, но все попытки исчерпаны
                    errorMessage = tRef.current('staff.finance.error.network', 'Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.');
                    logError('ShiftData', 'Network error after retries', e);
                } else if (e instanceof Response) {
                    // Если это Response объект (например, от fetchWithRetry при retryable ошибках)
                    // Это означает, что все попытки retry исчерпаны
                    if (e.status >= 500) {
                        errorMessage = tRef.current('staff.finance.error.server', 'Временная ошибка сервера. Пожалуйста, попробуйте через несколько секунд.');
                    } else if (e.status === 429) {
                        errorMessage = tRef.current('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                    } else {
                        errorMessage = tRef.current('staff.finance.error.server', 'Ошибка сервера. Попробуйте обновить страницу.');
                    }
                } else if (e instanceof TypeError) {
                    // Другие TypeError (не сетевые)
                    if (e.message.includes('JSON') || e.message.includes('parse')) {
                        errorMessage = tRef.current('staff.finance.error.parse', 'Ошибка обработки данных с сервера. Попробуйте обновить страницу.');
                    } else {
                        errorMessage = tRef.current('staff.finance.error.unknown', 'Произошла неожиданная ошибка. Попробуйте обновить страницу.');
                    }
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
                
                // Проверяем актуальность перед установкой ошибки
                if (lastRequestedDateRef.current === dateStr && requestCounterRef.current === currentRequestId) {
                    setToday({ ok: false, error: errorMessage });
                    toastRef.current.showError(errorMessage);
                }
            } finally {
                // Очищаем AbortController только если это был последний запрос
                if (abortControllerRef.current === abortController && 
                    lastRequestedDateRef.current === dateStr &&
                    requestCounterRef.current === currentRequestId) {
                    abortControllerRef.current = null;
                    setLoading(false);
                    setIsInitialLoad(false);
                    onDataLoadedRef.current?.();
                }
                // Очищаем ссылку на текущий запрос только если это был актуальный запрос
                if (currentRequestRef.current && 
                    currentRequestRef.current.dateStr === dateStr &&
                    currentRequestRef.current.requestId === currentRequestId) {
                    currentRequestRef.current = null;
                }
            }
        })();
        
        // Сохраняем промис текущего запроса с requestId
        currentRequestRef.current = { dateStr, requestId: currentRequestId, promise: requestPromise };
        
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
    
    // Первая загрузка данных - предотвращаем множественные запросы
    useEffect(() => {
        // Проверяем, не началась ли уже загрузка
        if (initialLoadStartedRef.current) {
            return;
        }
        
        // Проверяем, не идет ли уже запрос с той же датой
        const dateStr = formatInTimeZone(shiftDateRef.current, TZ, 'yyyy-MM-dd');
        if (currentRequestRef.current && currentRequestRef.current.dateStr === dateStr) {
            // Запрос уже идет, не делаем новый
            return;
        }
        
        // Проверяем кэш - если данные уже есть, не делаем запрос
        const cached = cacheRef.current.get(dateStr);
        if (cached) {
            const now = Date.now();
            const staticDataValid = cached.staticDataTimestamp && (now - cached.staticDataTimestamp < CACHE_TTL_STATIC);
            const bookingsValid = cached.bookingsTimestamp && (now - cached.bookingsTimestamp < CACHE_TTL_BOOKINGS);
            const shiftDataValid = cached.shiftDataTimestamp && (now - cached.shiftDataTimestamp < CACHE_TTL_SHIFT);
            const allShiftsValid = cached.allShiftsTimestamp && (now - cached.allShiftsTimestamp < CACHE_TTL_ALL_SHIFTS);
            
            if (staticDataValid && bookingsValid && shiftDataValid && allShiftsValid) {
                // Данные в кэше актуальны, не делаем запрос
                return;
            }
        }
        
        // Устанавливаем флаг, что загрузка началась
        initialLoadStartedRef.current = true;
        void load().finally(() => {
            // Сбрасываем флаг после завершения загрузки
            initialLoadStartedRef.current = false;
        });
    }, []); // Пустой массив зависимостей - выполняется только при монтировании

    // Перезагружаем данные при изменении даты смены (только для владельца)
    // Используем только shiftDateStr в зависимостях, чтобы избежать пересоздания объекта Date
    // Используем debounce для предотвращения множественных запросов при быстрой смене даты
    useEffect(() => {
        if (!isInitialLoad && staffId) {
            // Увеличенная задержка для debounce - если дата изменится снова, предыдущий запрос будет отменен
            const timeoutId = setTimeout(() => {
                // Проверяем, что дата все еще актуальна перед загрузкой
                const currentDateStr = formatInTimeZone(shiftDateRef.current, TZ, 'yyyy-MM-dd');
                if (currentDateStr === shiftDateStr) {
                    void load(shiftDateRef.current);
                }
            }, 300); // 300ms debounce для более стабильной работы
            
            return () => {
                clearTimeout(timeoutId);
            };
        }
    }, [shiftDateStr, staffId, isInitialLoad, load]);

    // Функция для инвалидации кэша
    const invalidateCache = useCallback((date?: Date) => {
        if (date) {
            const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
            cacheRef.current.delete(dateStr);
        } else {
            // Инвалидируем весь кэш
            cacheRef.current.clear();
        }
    }, []);

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
        invalidateCache,
        isInitialLoad,
    };
}

