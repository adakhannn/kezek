/**
 * Сервисный слой для получения данных смены сотрудника
 * Унифицированная логика для использования в разных API endpoints
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';

import { logError, logDebug } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readScheduledDay } from '@/lib/scheduling/read';
import { TZ } from '@/lib/time';

export interface ShiftDataServiceOptions {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
    targetDate: Date;
    useServiceClient?: boolean; // Для обхода RLS при просмотре менеджером
}

export interface ShiftDataServiceResult {
    ok: true;
    today: {
        exists: boolean;
        status: 'open' | 'closed' | 'none';
        shift: {
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
        } | null;
        items: Array<{
            id: string;
            client_name: string;
            service_name: string;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
            created_at: string;
        }>;
    };
    bookings: Array<{
        id: string;
        client_name: string | null;
        client_phone: string | null;
        start_at: string;
        services: {
            name_ru: string;
            name_ky: string | null;
            name_en: string | null;
        } | null;
    }>;
    services: Array<{ name_ru: string; name_ky: string | null; name_en: string | null }>;
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
    stats?: {
        totalAmount: number;
        totalMaster: number;
        totalSalon: number;
        totalLateMinutes: number;
        shiftsCount: number;
    };
}

/**
 * Получает данные смены для указанной даты
 */
export async function getShiftData({
    supabase,
    staffId,
    bizId,
    targetDate,
    useServiceClient = false
}: ShiftDataServiceOptions): Promise<ShiftDataServiceResult> {
    // Если нужен service client для обхода RLS, получаем его
    let client = supabase;
    if (useServiceClient) {
        try {
            const { getServiceClient } = await import('@/lib/supabaseService');
            client = getServiceClient();
        } catch (e) {
            // В деве/локально сервисный ключ может быть не задан.
            // В этом случае падает getServiceClient со ссылкой на SUPABASE_SERVICE_ROLE_KEY.
            // Чтобы страница не ломалась, логируем как debug и продолжаем с обычным клиентом (c RLS).
            logDebug('ShiftDataService', 'Failed to create service client, falling back to provided supabase client', e);
            client = supabase;
        }
    }
    
    // Дата в локальной TZ (без времени)
    const scheduledDay = explicitSchedulingEnabled() ? await readScheduledDay(staffId, bizId, targetDate) : null;
    const ymd = scheduledDay?.ymd ?? formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
    const dow = new Date(ymd + 'T12:00:00').getDay(); // 0-6
    const today = formatInTimeZone(new Date(), scheduledDay?.day.tz ?? TZ, 'yyyy-MM-dd');
    const dateStart = `${ymd}T00:00:00`;
    const dateEnd = `${ymd}T23:59:59`;

    // Вспомогательная обёртка для замера времени выполнения отдельных частей
    // Supabase возвращает PostgrestBuilder (thenable), поэтому принимаем PromiseLike<T>
    const measurePart = async <T>(part: string, fn: () => PromiseLike<T>): Promise<T> => {
        const t0 = Date.now();
        try {
            return await Promise.resolve(fn());
        } finally {
            const durationMs = Date.now() - t0;
            logDebug('ShiftDataService', 'Query timing', {
                part,
                durationMs,
                staffId,
                ymd,
            });
        }
    };

    // Выполняем все независимые запросы параллельно для ускорения загрузки
    const basePromises = [
        // 1. Настройки сотрудника (проценты и ставка)
        measurePart('staff', () =>
            client
                .from('staff')
                .select('percent_master, percent_salon, hourly_rate')
                .eq('id', staffId)
                .maybeSingle(),
        ),

        // 2. Смена за выбранную дату с позициями (объединенный запрос для уменьшения количества запросов)
        measurePart('shift_with_items', () =>
            client
                .from('staff_shifts')
                .select('id, shift_date, opened_at, closed_at, expected_start, late_minutes, status, total_amount, consumables_amount, master_share, salon_share, percent_master, percent_salon, hours_worked, hourly_rate, guaranteed_amount, topup_amount, staff_shift_items(id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at)')
                .eq('staff_id', staffId)
                .eq('shift_date', ymd)
                .maybeSingle(),
        ),

        // 3. Записи (bookings) сотрудника за выбранную дату
        measurePart('bookings', () =>
            client
                .from('bookings')
                .select(
                    `
                id,
                client_name,
                client_phone,
                start_at,
                services:services!bookings_service_id_fkey (name_ru, name_ky, name_en),
                booking_services (
                    service:services (name_ru, name_ky, name_en)
                )
            `,
                )
                .eq('staff_id', staffId)
                .gte('start_at', dateStart)
                .lte('start_at', dateEnd)
                .neq('status', 'cancelled')
                .order('start_at', { ascending: true }),
        ),

        // 4. Услуги сотрудника для выпадающего списка
        measurePart('services', () =>
            client
                .from('service_staff')
                .select('services:services!inner (name_ru, name_ky, name_en)')
                .eq('staff_id', staffId)
                .eq('is_active', true)
                .eq('services.active', true),
        ),
    ];

    // Добавляем проверку выходного дня и allShifts только если это сегодня (всё в одном батче)
    const dayOffPromises = ymd === today ? [
        // 5. Проверяем staff_time_off
        measurePart('day_off_time_off', () =>
            client
                .from('staff_time_off')
                .select('id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .lte('date_from', ymd)
                .gte('date_to', ymd),
        ),

        // 6. Проверяем staff_schedule_rules для конкретной даты
        measurePart('day_off_date_rule', () =>
            client
                .from('staff_schedule_rules')
                .select('intervals, is_active')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('date_on', ymd)
                .eq('is_active', true)
                .maybeSingle(),
        ),

        // 7. Проверяем еженедельное расписание
        measurePart('day_off_weekly_schedule', () =>
            client
                .from('working_hours')
                .select('intervals')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('day_of_week', dow)
                .maybeSingle(),
        ),

        // 8. allShifts для сегодня — в том же батче, без второго await
        measurePart('all_shifts_today', () =>
            client
                .from('staff_shifts')
                .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes, guaranteed_amount, topup_amount')
                .eq('staff_id', staffId)
                .order('shift_date', { ascending: false }),
        ),
    ] : [];

    const allPromises = [...basePromises, ...dayOffPromises];
    const results = await Promise.all(allPromises);

    // Обрабатываем результаты с явной типизацией
    const staffDataResult = results[0] as { data: { percent_master: number | null; percent_salon: number | null; hourly_rate: number | null } | null; error: unknown };
    const shiftResult = results[1] as { data: unknown; error: { message?: string } | null };
    const bookingsResult = results[2] as {
        data: Array<{
            id: string;
            client_name: string | null;
            client_phone: string | null;
            start_at: string;
            services:
                | { name_ru: string; name_ky?: string | null; name_en?: string | null }
                | { name_ru: string; name_ky?: string | null; name_en?: string | null }[]
                | null;
            booking_services?:
                | {
                      service?: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null;
                  }[]
                | null;
        }> | null;
        error: unknown;
    };
    const servicesResult = results[3] as { data: Array<{
        services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null;
    }> | null; error: unknown };
    const dayOffResults = results.slice(4) as Array<{ data: unknown; error: unknown }>;
    const allShiftsFromBatch = ymd === today ? (dayOffResults[3] as AllShiftsResult) : null;
    
    const { data: staffData, error: staffError } = staffDataResult;
    if (staffError) {
        logError('ShiftDataService', 'Error loading staff for percent', staffError);
    }

    const staffPercentMaster = Number(staffData?.percent_master ?? 60);
    const staffPercentSalon = Number(staffData?.percent_salon ?? 40);
    const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;

    const { data: shiftRaw, error: shiftError } = shiftResult;
    if (shiftError) {
        logError('ShiftDataService', 'Error loading shift', shiftError);
        throw new Error(`Failed to load shift: ${shiftError?.message || 'Unknown error'}`);
    }

    // Извлекаем items из объединенного запроса и отделяем их от данных смены
    type ShiftWithItems = {
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
        staff_shift_items?: Array<{
            id: string;
            client_name: string;
            service_name: string;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
            created_at: string;
        }> | null;
    };

    const shiftWithItems = shiftRaw as ShiftWithItems | null;
    const shift = shiftWithItems ? {
        id: shiftWithItems.id,
        shift_date: shiftWithItems.shift_date,
        opened_at: shiftWithItems.opened_at,
        closed_at: shiftWithItems.closed_at,
        expected_start: shiftWithItems.expected_start,
        late_minutes: shiftWithItems.late_minutes,
        status: shiftWithItems.status,
        total_amount: shiftWithItems.total_amount,
        consumables_amount: shiftWithItems.consumables_amount,
        master_share: shiftWithItems.master_share,
        salon_share: shiftWithItems.salon_share,
        percent_master: shiftWithItems.percent_master,
        percent_salon: shiftWithItems.percent_salon,
        hours_worked: shiftWithItems.hours_worked,
        hourly_rate: shiftWithItems.hourly_rate,
        guaranteed_amount: shiftWithItems.guaranteed_amount,
        topup_amount: shiftWithItems.topup_amount,
    } : null;

    // Извлекаем items из объединенного запроса
    const itemsFromJoin = shiftWithItems?.staff_shift_items ?? null;

    const { data: dateBookingsRaw, error: bookingsError } = bookingsResult;
    if (bookingsError) {
        logError('ShiftDataService', 'Error loading bookings', bookingsError);
    }

    const { data: staffServices, error: servicesError } = servicesResult;
    if (servicesError) {
        logError('ShiftDataService', 'Error loading staff services', servicesError);
    }

    // Обрабатываем проверку выходного дня
    let isDayOff = false;
    if (scheduledDay) {
        isDayOff = !scheduledDay.day.intervals.length;
    } else if (ymd === today && dayOffResults.length >= 3) {
        const [timeOffsResult, dateRuleResult, whRowResult] = dayOffResults;

        // 1. Проверяем staff_time_off
        if (timeOffsResult.data && Array.isArray(timeOffsResult.data) && timeOffsResult.data.length > 0) {
            isDayOff = true;
        } else {
            // 2. Проверяем staff_schedule_rules для конкретной даты
            const dateRule = dateRuleResult.data as { intervals: unknown; is_active: boolean } | null;
            if (dateRule && dateRule.is_active) {
                const intervals = (dateRule.intervals ?? []) as { start: string; end: string }[];
                if (!Array.isArray(intervals) || intervals.length === 0) {
                    isDayOff = true;
                }
            } else {
                // 3. Проверяем еженедельное расписание
                const whRow = whRowResult.data as { intervals: unknown } | null;
                const intervals = (whRow?.intervals ?? []) as { start: string; end: string }[];
                if (!Array.isArray(intervals) || intervals.length === 0) {
                    isDayOff = true;
                }
            }
        }
    }

    // Обрабатываем items из объединенного запроса
    // Items уже загружены вместе со сменой через JOIN, сортируем их
    let items: Array<{
        id: string;
        client_name: string;
        service_name: string;
        service_amount: number;
        consumables_amount: number;
        note: string | null;
        booking_id: string | null;
        created_at: string;
    }> = [];
    
    if (itemsFromJoin && Array.isArray(itemsFromJoin)) {
        // Сортируем items по created_at и id (descending)
        items = [...itemsFromJoin].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            if (dateB !== dateA) {
                return dateB - dateA; // Сначала более новые
            }
            // Если даты равны, сортируем по id
            return b.id.localeCompare(a.id);
        });
    }

    // allShifts уже загружены в первом батче (allShiftsFromBatch), когда ymd === today
    type AllShiftsResult = { data: Array<{
        shift_date: string | Date;
        status: string;
        total_amount: number | null;
        master_share: number | null;
        salon_share: number | null;
        late_minutes: number | null;
        guaranteed_amount?: number | null;
        topup_amount?: number | null;
    }> | null; error: unknown };
    
    const allShiftsResult: AllShiftsResult | null = allShiftsFromBatch;

    // Преобразуем bookings:
    // - базовая услуга из bookings.service_id (services)
    // - дополнительные услуги из booking_services (complex)
    const dateBookings = (dateBookingsRaw ?? []).map(
        (booking: {
            id: string;
            client_name: string | null;
            client_phone: string | null;
            start_at: string;
            services:
                | { name_ru: string; name_ky?: string | null; name_en?: string | null }
                | { name_ru: string; name_ky?: string | null; name_en?: string | null }[]
                | null;
            booking_services?:
                | {
                      service?: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null;
                  }[]
                | null;
        }) => {
            const baseServices = Array.isArray(booking.services)
                ? booking.services
                : booking.services
                ? [booking.services]
                : [];
            const extraServices =
                booking.booking_services && Array.isArray(booking.booking_services)
                    ? booking.booking_services
                          .map((bs) => bs.service)
                          .filter(
                              (s): s is { name_ru: string; name_ky?: string | null; name_en?: string | null } =>
                                  !!s && typeof s === 'object' && typeof s.name_ru === 'string',
                          )
                    : [];

            // Убираем дубликаты по name_ru: базовая услуга может повторяться в booking_services
            const seenNames = new Set<string>();
            const allServices: Array<{ name_ru: string; name_ky?: string | null; name_en?: string | null }> = [];
            for (const svc of [...baseServices, ...extraServices]) {
                const key = (svc.name_ru || '').trim();
                if (key && !seenNames.has(key)) {
                    seenNames.add(key);
                    allServices.push(svc);
                }
            }

            if (allServices.length === 0) {
                return {
                    id: booking.id,
                    client_name: booking.client_name,
                    client_phone: booking.client_phone,
                    start_at: booking.start_at,
                    services: null,
                };
            }

            // Интерфейс ожидает одну услугу или null; для комплексов берём первую
            const first = allServices[0];
            return {
                id: booking.id,
                client_name: booking.client_name,
                client_phone: booking.client_phone,
                start_at: booking.start_at,
                services: {
                    name_ru: first.name_ru || '',
                    name_ky: first.name_ky ?? null,
                    name_en: first.name_en ?? null,
                },
            };
        },
    );

    const availableServices = (staffServices ?? [])
        .map((ss: { services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null }) => {
            const svc = Array.isArray(ss.services) ? ss.services[0] : ss.services;
            return svc ? { name_ru: svc.name_ru, name_ky: svc.name_ky ?? null, name_en: svc.name_en ?? null } : null;
        })
        .filter((svc: { name_ru: string; name_ky: string | null; name_en: string | null } | null): svc is { name_ru: string; name_ky: string | null; name_en: string | null } => !!svc);

    // Расчет текущих часов работы и суммы за выход для открытой смены
    let currentHoursWorked: number | null = null;
    let currentGuaranteedAmount: number | null = null;

    if (shift && shift.status === 'open' && shift.opened_at && hourlyRate) {
        const openedAt = new Date(shift.opened_at);
        const now = new Date();
        const diffMs = now.getTime() - openedAt.getTime();
        currentHoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // округляем до 2 знаков
        currentGuaranteedAmount = Math.round(currentHoursWorked * hourlyRate * 100) / 100;
    }

    // Обрабатываем allShifts и статистику (только если запрашивается сегодня)
    let allShifts: Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }> = [];
    
    let stats: {
        totalAmount: number;
        totalMaster: number;
        totalSalon: number;
        totalLateMinutes: number;
        shiftsCount: number;
    } | undefined;

    if (ymd === today && allShiftsResult) {
        const { data: allShiftsData, error: statsError } = allShiftsResult as AllShiftsResult;
        
        if (statsError) {
            logError('ShiftDataService', 'Error loading shifts stats', statsError);
        } else {
            allShifts = ((allShiftsData as Array<{
                shift_date: string | Date;
                status: string;
                total_amount: number | null;
                master_share: number | null;
                salon_share: number | null;
                late_minutes: number | null;
                guaranteed_amount?: number | null;
                topup_amount?: number | null;
            }>) ?? []).map((s) => ({
                shift_date: String(s.shift_date || '').split('T')[0].split(' ')[0], // Нормализуем дату в формат YYYY-MM-DD
                status: s.status,
                total_amount: Number(s.total_amount ?? 0),
                master_share: Number(s.master_share ?? 0),
                salon_share: Number(s.salon_share ?? 0),
                late_minutes: Number(s.late_minutes ?? 0),
                guaranteed_amount: Number(s.guaranteed_amount ?? 0),
                topup_amount: Number(s.topup_amount ?? 0),
            }));

            const closed = allShifts.filter((s) => s.status === 'closed');
            const totalAmount = closed.reduce((sum, s) => sum + s.total_amount, 0);
            const totalMaster = closed.reduce((sum, s) => {
                const guaranteed = s.guaranteed_amount ?? 0;
                const masterShare = s.master_share;
                return sum + (guaranteed > masterShare ? guaranteed : masterShare);
            }, 0);
            const totalSalon = closed.reduce((sum, s) => {
                const salonShare = s.salon_share;
                const topup = s.topup_amount ?? 0;
                return sum + salonShare - topup;
            }, 0);
            const totalLateMinutes = closed.reduce((sum, s) => sum + s.late_minutes, 0);

            stats = {
                totalAmount,
                totalMaster,
                totalSalon,
                totalLateMinutes,
                shiftsCount: closed.length,
            };
        }
    }

    return {
        ok: true,
        today: shift
            ? {
                  exists: true,
                  status: shift.status as 'open' | 'closed',
                  shift,
                  items,
              }
            : {
                  exists: false,
                  status: 'none' as const,
                  shift: null,
                  items: [],
              },
        bookings: dateBookings ?? [],
        services: availableServices,
        staffPercentMaster,
        staffPercentSalon,
        hourlyRate,
        currentHoursWorked,
        currentGuaranteedAmount,
        isDayOff,
        allShifts,
        stats,
    };
}

/** Элемент смены в формате API (camelCase) */
export type FinanceResponsePayloadItem = {
    id: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId: string | null;
    createdAt: string | null;
};

/** Формат ответа для API и SSR: today.items в camelCase, остальное без изменений */
export type FinanceResponsePayload = {
    today: Omit<ShiftDataServiceResult['today'], 'items'> & {
        items: FinanceResponsePayloadItem[];
    };
    bookings: ShiftDataServiceResult['bookings'];
    services: ShiftDataServiceResult['services'];
    allShifts: ShiftDataServiceResult['allShifts'];
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
    stats: ShiftDataServiceResult['stats'];
};

/**
 * Строит payload для API / SSR из результата getShiftData (items в camelCase).
 * Используется в API route и при серверном prefetch для страницы финансов.
 */
export function buildFinanceResponsePayload(result: ShiftDataServiceResult): FinanceResponsePayload {
    const items: FinanceResponsePayloadItem[] = (result.today.items || []).map((item) => ({
        id: item.id,
        clientName: item.client_name || '',
        serviceName: item.service_name || '',
        serviceAmount: item.service_amount || 0,
        consumablesAmount: item.consumables_amount || 0,
        bookingId: item.booking_id || null,
        createdAt: item.created_at ?? null,
    }));
    return {
        today: { ...result.today, items },
        bookings: result.bookings,
        services: result.services,
        allShifts: result.allShifts,
        staffPercentMaster: result.staffPercentMaster,
        staffPercentSalon: result.staffPercentSalon,
        hourlyRate: result.hourlyRate,
        currentHoursWorked: result.currentHoursWorked,
        currentGuaranteedAmount: result.currentGuaranteedAmount,
        isDayOff: result.isDayOff,
        stats: result.stats,
    };
}

