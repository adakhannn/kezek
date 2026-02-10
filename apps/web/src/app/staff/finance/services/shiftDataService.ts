/**
 * Сервисный слой для получения данных смены сотрудника
 * Унифицированная логика для использования в разных API endpoints
 */

import { formatInTimeZone } from 'date-fns-tz';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logError, logDebug } from '@/lib/log';
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
    
    // Получаем проценты и ставку за час из настроек сотрудника
    const { data: staffData, error: staffError } = await client
        .from('staff')
        .select('percent_master, percent_salon, hourly_rate')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('ShiftDataService', 'Error loading staff for percent', staffError);
    }

    const staffPercentMaster = Number(staffData?.percent_master ?? 60);
    const staffPercentSalon = Number(staffData?.percent_salon ?? 40);
    const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;

    // Дата в локальной TZ (без времени)
    const ymd = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
    const dow = new Date(ymd + 'T12:00:00').getDay(); // 0-6

    // Проверяем, выходной ли для выбранной даты
    let isDayOff = false;
    const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    
    // Проверяем выходной только если это сегодня (для оптимизации)
    if (ymd === today) {
        // 1. Проверяем staff_time_off
        const { data: timeOffs } = await client
            .from('staff_time_off')
            .select('id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lte('date_from', ymd)
            .gte('date_to', ymd);

        if (timeOffs && timeOffs.length > 0) {
            isDayOff = true;
        } else {
            // 2. Проверяем staff_schedule_rules для конкретной даты
            const { data: dateRule } = await client
                .from('staff_schedule_rules')
                .select('intervals, is_active')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('date_on', ymd)
                .eq('is_active', true)
                .maybeSingle();

            if (dateRule && dateRule.is_active) {
                const intervals = (dateRule.intervals ?? []) as { start: string; end: string }[];
                if (!Array.isArray(intervals) || intervals.length === 0) {
                    isDayOff = true;
                }
            } else {
                // 3. Проверяем еженедельное расписание
                const { data: whRow } = await client
                    .from('working_hours')
                    .select('intervals')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('day_of_week', dow)
                    .maybeSingle();

                const intervals = (whRow?.intervals ?? []) as { start: string; end: string }[];
                if (!Array.isArray(intervals) || intervals.length === 0) {
                    isDayOff = true;
                }
            }
        }
    }

    // Смена за выбранную дату
    const { data: shift, error: shiftError } = await client
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (shiftError) {
        logError('ShiftDataService', 'Error loading shift', shiftError);
        throw new Error(`Failed to load shift: ${shiftError.message}`);
    }

    // Позиции по клиентам для текущей смены
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
    if (shift) {
        const { data: itemsData, error: itemsError } = await client
            .from('staff_shift_items')
            .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
            .eq('shift_id', shift.id)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (itemsError) {
            logError('ShiftDataService', 'Error loading shift items', itemsError);
        } else {
            items = itemsData ?? [];
        }
    }

    // Записи (bookings) сотрудника за выбранную дату
    const dateStart = `${ymd}T00:00:00`;
    const dateEnd = `${ymd}T23:59:59`;
    const { data: dateBookings, error: bookingsError } = await client
        .from('bookings')
        .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
        .eq('staff_id', staffId)
        .gte('start_at', dateStart)
        .lte('start_at', dateEnd)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });

    if (bookingsError) {
        logError('ShiftDataService', 'Error loading bookings', bookingsError);
    }

    // Услуги сотрудника для выпадающего списка
    const { data: staffServices, error: servicesError } = await client
        .from('service_staff')
        .select('services:services!inner (name_ru, name_ky, name_en)')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .eq('services.active', true);

    if (servicesError) {
        logError('ShiftDataService', 'Error loading staff services', servicesError);
    }

    const availableServices = (staffServices ?? [])
        .map((ss: { services: { name_ru: string; name_ky?: string | null; name_en?: string | null } | { name_ru: string; name_ky?: string | null; name_en?: string | null }[] | null }) => {
            const svc = Array.isArray(ss.services) ? ss.services[0] : ss.services;
            return svc ? { name_ru: svc.name_ru, name_ky: svc.name_ky ?? null, name_en: svc.name_en ?? null } : null;
        })
        .filter((svc): svc is { name_ru: string; name_ky: string | null; name_en: string | null } => !!svc);

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

    // Общая статистика по всем закрытым сменам сотрудника (только если запрашивается сегодня)
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

    // Загружаем статистику только если запрашивается сегодня (для оптимизации)
    if (ymd === today) {
        const { data: allShiftsData, error: statsError } = await client
            .from('staff_shifts')
            .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes, guaranteed_amount, topup_amount')
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });

        if (statsError) {
            logError('ShiftDataService', 'Error loading shifts stats', statsError);
        } else {
            allShifts = (allShiftsData ?? []).map((s) => ({
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

