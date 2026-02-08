// apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: staffId } = await params;
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметр date из query string, если он есть
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');
        let targetDate: Date;
        if (dateParam) {
            // Парсим дату из параметра (формат YYYY-MM-DD)
            const [year, month, day] = dateParam.split('-').map(Number);
            targetDate = new Date(year, month - 1, day);
        } else {
            targetDate = new Date();
        }

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id, percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError || !staff || String(staff.biz_id) !== String(bizId)) {
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        const staffPercentMaster = Number(staff.percent_master ?? 60);
        const staffPercentSalon = Number(staff.percent_salon ?? 40);
        const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

        // Дата в локальной TZ (без времени)
        const ymd = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');

        // Проверяем, выходной ли для выбранной даты (только если это сегодня)
        let isDayOff = false;
        const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
        if (ymd === today) {
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
                    .select('intervals')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('kind', 'date')
                    .eq('date_on', ymd)
                    .eq('is_active', true)
                    .maybeSingle();

                if (dateRule && Array.isArray(dateRule.intervals) && dateRule.intervals.length === 0) {
                    isDayOff = true;
                }
            }
        }

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Смена за выбранную дату
        const { data: shift, error: shiftError } = await admin
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (shiftError) {
            logError('StaffFinance', 'Error loading shift', shiftError);
            return NextResponse.json(
                { ok: false, error: shiftError.message },
                { status: 500 }
            );
        }

        // Позиции по клиентам для текущей смены
        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        let items: unknown[] = [];
        if (shift) {
            const { data: itemsData, error: itemsError } = await admin
                .from('staff_shift_items')
                .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (itemsError) {
                logError('StaffFinance', 'Error loading shift items', itemsError);
            } else {
                items = itemsData ?? [];
            }
        }

        // Записи (bookings) сотрудника за выбранную дату для выбора клиентов
        const dateStart = `${ymd}T00:00:00`;
        const dateEnd = `${ymd}T23:59:59`;
        const { data: dateBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .gte('start_at', dateStart)
            .lte('start_at', dateEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true });

        if (bookingsError) {
            logError('StaffFinance', 'Error loading bookings', bookingsError);
        }

        // Услуги сотрудника для выпадающего списка
        const { data: staffServices, error: servicesError } = await supabase
            .from('service_staff')
            .select('services:services!inner (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .eq('services.active', true);

        if (servicesError) {
            logError('StaffFinance', 'Error loading staff services', servicesError);
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
            const nowDate = new Date();
            const diffMs = nowDate.getTime() - openedAt.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            currentHoursWorked = Math.max(0, diffHours);
            currentGuaranteedAmount = currentHoursWorked * hourlyRate;
        }

        // Статистика за последние 30 дней
        const thirtyDaysAgo = new Date(targetDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const statsStart = formatInTimeZone(thirtyDaysAgo, TZ, 'yyyy-MM-dd');

        const { data: recentShifts, error: statsError } = await admin
            .from('staff_shifts')
            .select('total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('status', 'closed')
            .gte('shift_date', statsStart)
            .order('shift_date', { ascending: false });

        if (statsError) {
            logError('StaffFinance', 'Error loading stats', statsError);
        }

        // Загружаем все смены (не только закрытые) для статистики - клиент фильтрует по статусу
        const { data: allShifts, error: allShiftsError } = await admin
            .from('staff_shifts')
            .select('shift_date, status, total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });

        if (allShiftsError) {
            logError('StaffFinance', 'Error loading all shifts', allShiftsError);
        }

        const stats = {
            totalAmount: 0,
            totalMaster: 0,
            totalSalon: 0,
            totalLateMinutes: 0,
            shiftsCount: 0,
        };

        if (recentShifts) {
            for (const s of recentShifts) {
                stats.totalAmount += Number(s.total_amount ?? 0);
                stats.totalMaster += Number(s.master_share ?? 0);
                stats.totalSalon += Number(s.salon_share ?? 0);
                stats.totalLateMinutes += Number(s.late_minutes ?? 0);
                stats.shiftsCount += 1;
            }
        }

        return NextResponse.json({
            ok: true,
            today: shift
                ? {
                      exists: true,
                      status: shift.status,
                      shift: {
                          id: shift.id,
                          shift_date: shift.shift_date,
                          opened_at: shift.opened_at,
                          closed_at: shift.closed_at,
                          expected_start: shift.expected_start,
                          late_minutes: shift.late_minutes ?? 0,
                          status: shift.status,
                          total_amount: shift.total_amount ?? 0,
                          consumables_amount: shift.consumables_amount ?? 0,
                          master_share: shift.master_share ?? 0,
                          salon_share: shift.salon_share ?? 0,
                          percent_master: staffPercentMaster,
                          percent_salon: staffPercentSalon,
                          hours_worked: shift.hours_worked,
                          hourly_rate: hourlyRate,
                          guaranteed_amount: shift.guaranteed_amount,
                          topup_amount: shift.topup_amount,
                      },
                      items: items,
                  }
                : {
                      exists: false,
                      status: 'none',
                      shift: null,
                      items: [],
                  },
            bookings: dateBookings ?? [],
            services: availableServices,
            // Возвращаем все смены (не только закрытые), фильтрация по статусу на клиенте
            allShifts: (allShifts ?? []).map((s) => ({
                shift_date: s.shift_date,
                status: s.status,
                total_amount: Number(s.total_amount ?? 0),
                master_share: Number(s.master_share ?? 0),
                salon_share: Number(s.salon_share ?? 0),
                late_minutes: Number(s.late_minutes ?? 0),
            })),
            staffPercentMaster,
            staffPercentSalon,
            hourlyRate,
            currentHoursWorked,
            currentGuaranteedAmount,
            isDayOff,
            stats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('StaffFinance', 'Unexpected error', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

