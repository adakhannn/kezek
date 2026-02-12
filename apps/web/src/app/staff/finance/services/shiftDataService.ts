/**
 * Сервисный слой для получения данных смены сотрудника
 * Унифицированная логика для использования в разных API endpoints
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';

import { logError } from '@/lib/log';
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
        const { getServiceClient } = await import('@/lib/supabaseService');
        client = getServiceClient();
    }
    
    // Дата в локальной TZ (без времени)
    const ymd = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
    const dow = new Date(ymd + 'T12:00:00').getDay(); // 0-6
    const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const dateStart = `${ymd}T00:00:00`;
    const dateEnd = `${ymd}T23:59:59`;

    // Выполняем все независимые запросы параллельно для ускорения загрузки
    const basePromises = [
        // 1. Настройки сотрудника (проценты и ставка)
        client
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle(),
        
        // 2. Смена за выбранную дату с позициями (объединенный запрос для уменьшения количества запросов)
        client
            .from('staff_shifts')
            .select('id, shift_date, opened_at, closed_at, expected_start, late_minutes, status, total_amount, consumables_amount, master_share, salon_share, percent_master, percent_salon, hours_worked, hourly_rate, guaranteed_amount, topup_amount, staff_shift_items(id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at)')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle(),
        
        // 3. Записи (bookings) сотрудника за выбранную дату
        client
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .gte('start_at', dateStart)
            .lte('start_at', dateEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true }),
        
        // 4. Услуги сотрудника для выпадающего списка
        client
            .from('service_staff')
            .select('services:services!inner (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .eq('services.active', true),
    ];

    // Добавляем проверку выходного дня только если это сегодня
    const dayOffPromises = ymd === today ? [
        // 5. Проверяем staff_time_off
        client
            .from('staff_time_off')
            .select('id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lte('date_from', ymd)
            .gte('date_to', ymd),
        
        // 6. Проверяем staff_schedule_rules для конкретной даты
        client
            .from('staff_schedule_rules')
            .select('intervals, is_active')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('date_on', ymd)
            .eq('is_active', true)
            .maybeSingle(),
        
        // 7. Проверяем еженедельное расписание
        client
            .from('working_hours')
            .select('intervals')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('day_of_week', dow)
            .maybeSingle(),
    ] : [];

    const allPromises = [...basePromises, ...dayOffPromises];
    const results = await Promise.all(allPromises);

    // Обрабатываем результаты с явной типизацией
    const staffDataResult = results[0] as { data: { percent_master: number | null; percent_salon: number | null; hourly_rate: number | null } | null; error: unknown };
    const shiftResult = results[1] as { data: unknown; error: { message?: string } | null };
    const bookingsResult = results[2] as { data: Array<{
        id: string;
        client_name: string | null;
        client_phone: string | null;
        start_at: string;
        services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null;
    }> | null; error: unknown };
    const servicesResult = results[3] as { data: Array<{
        services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null;
    }> | null; error: unknown };
    const dayOffResults = results.slice(4) as Array<{ data: unknown; error: unknown }>;
    
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
    if (ymd === today && dayOffResults.length >= 3) {
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

    // Загружаем allShifts (только если запрашивается сегодня)
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
    
    let allShiftsResult: AllShiftsResult | null = null;
    
    if (ymd === today) {
        const result = await client
            .from('staff_shifts')
            .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes, guaranteed_amount, topup_amount')
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });
        
        allShiftsResult = result as AllShiftsResult;
    }

    // Преобразуем bookings: services может быть массивом из-за join, но нам нужен объект или null
    const dateBookings = (dateBookingsRaw ?? []).map((booking: {
        id: string;
        client_name: string | null;
        client_phone: string | null;
        start_at: string;
        services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null;
    }) => {
        const services = Array.isArray(booking.services) 
            ? (booking.services.length > 0 ? booking.services[0] : null)
            : booking.services;
        return {
            id: booking.id,
            client_name: booking.client_name,
            client_phone: booking.client_phone,
            start_at: booking.start_at,
            services: services ? {
                name_ru: services.name_ru || '',
                name_ky: services.name_ky ?? null,
                name_en: services.name_en ?? null,
            } : null,
        };
    });

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

