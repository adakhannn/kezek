/**
 * @deprecated Используйте /api/staff/finance вместо этого endpoint
 * Этот endpoint сохранен для обратной совместимости
 * 
 * Миграция:
 * - Старый: GET /api/staff/shift/today
 * - Новый: GET /api/staff/finance
 */
// apps/web/src/app/api/staff/shift/today/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { logError, logWarn } from '@/lib/log';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    // Предупреждение о deprecated endpoint
    logWarn('StaffShiftToday', 'Deprecated endpoint used. Please migrate to /api/staff/finance');
    try {
        const { supabase, staffId, bizId } = await getStaffContext();

        // Получаем проценты и ставку за час из настроек сотрудника
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffShiftToday', 'Error loading staff for percent', staffError);
        }

        const staffPercentMaster = Number(staffData?.percent_master ?? 60);
        const staffPercentSalon = Number(staffData?.percent_salon ?? 40);
        const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;

        // Текущая дата в локальной TZ (без времени)
        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
        const dow = new Date(ymd + 'T12:00:00').getDay(); // 0-6

        // Проверяем, выходной ли сегодня
        let isDayOff = false;

        // 1. Проверяем staff_time_off
        const { data: timeOffs } = await supabase
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
            const { data: dateRule } = await supabase
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
                const { data: whRow } = await supabase
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

        // Текущая смена
        const { data: shift, error: shiftError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (shiftError) {
            logError('StaffShiftToday', 'Error loading today shift', shiftError);
            return NextResponse.json(
                { ok: false, error: shiftError.message },
                { status: 500 }
            );
        }

        // Позиции по клиентам для текущей смены
        let items: unknown[] = [];
        if (shift) {
            const { data: itemsData, error: itemsError } = await supabase
                .from('staff_shift_items')
                .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (itemsError) {
                logError('StaffShiftToday', 'Error loading shift items', itemsError);
            } else {
                items = itemsData ?? [];
            }
        }

        // Записи (bookings) сотрудника за сегодня для выбора клиентов
        const todayStart = `${ymd}T00:00:00`;
        const todayEnd = `${ymd}T23:59:59`;
        const { data: todayBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .gte('start_at', todayStart)
            .lte('start_at', todayEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true });

        if (bookingsError) {
            logError('StaffShiftToday', 'Error loading today bookings', bookingsError);
        }

        // Услуги сотрудника для выпадающего списка
        const { data: staffServices, error: servicesError } = await supabase
            .from('service_staff')
            .select('services:services!inner (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .eq('services.active', true);

        if (servicesError) {
            logError('StaffShiftToday', 'Error loading staff services', servicesError);
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

        // Общая статистика по всем закрытым сменам сотрудника
        const { data: allShifts, error: statsError } = await supabase
            .from('staff_shifts')
            .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes, guaranteed_amount, topup_amount')
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });

        if (statsError) {
            logError('StaffShiftToday', 'Error loading shifts stats', statsError);
            return NextResponse.json(
                { ok: false, error: statsError.message },
                { status: 500 }
            );
        }

        const closed = (allShifts ?? []).filter((s) => s.status === 'closed');
        const totalAmount = closed.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        // Итоговая сумма сотрудника = гарантированная сумма (если есть) или базовая доля
        // guaranteed_amount уже учитывает topup_amount, если он был (гарантия >= базовая доля)
        const totalMaster = closed.reduce((sum, s) => {
            const guaranteed = Number(s.guaranteed_amount || 0);
            const masterShare = Number(s.master_share || 0);
            // Если есть гарантированная сумма и она больше базовой доли, используем гарантию
            // Иначе используем базовую долю
            return sum + (guaranteed > masterShare ? guaranteed : masterShare);
        }, 0);
        const totalSalon = closed.reduce((sum, s) => {
            const guaranteed = Number(s.guaranteed_amount || 0);
            const masterShare = Number(s.master_share || 0);
            const salonShare = Number(s.salon_share || 0);
            const topup = Number(s.topup_amount || 0);
            // Бизнес получает долю от выручки, но вычитает доплату владельца, если она была
            return sum + salonShare - topup;
        }, 0);
        const totalLateMinutes = closed.reduce((sum, s) => sum + Number(s.late_minutes || 0), 0);

        return NextResponse.json({
            allShifts: (allShifts ?? []).map((s) => ({
                shift_date: String(s.shift_date || '').split('T')[0].split(' ')[0], // Нормализуем дату в формат YYYY-MM-DD
                status: s.status,
                total_amount: Number(s.total_amount ?? 0),
                master_share: Number(s.master_share ?? 0),
                salon_share: Number(s.salon_share ?? 0),
                late_minutes: Number(s.late_minutes ?? 0),
                guaranteed_amount: Number(s.guaranteed_amount ?? 0),
                topup_amount: Number(s.topup_amount ?? 0),
            })),
            ok: true,
            today: shift
                ? {
                      exists: true,
                      status: shift.status,
                      shift,
                      items,
                  }
                : {
                      exists: false,
                      status: 'none' as const,
                      shift: null,
                      items: [],
                  },
            staffPercentMaster: staffPercentMaster,
            staffPercentSalon: staffPercentSalon,
            hourlyRate: hourlyRate,
            currentHoursWorked: currentHoursWorked,
            currentGuaranteedAmount: currentGuaranteedAmount,
            bookings: todayBookings ?? [],
            services: availableServices,
            isDayOff: isDayOff,
            stats: {
                totalAmount,
                totalMaster,
                totalSalon,
                totalLateMinutes,
                shiftsCount: closed.length,
            },
        });
    } catch (error) {
        logError('StaffShiftToday', 'Unexpected error in /api/staff/shift/today', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}


