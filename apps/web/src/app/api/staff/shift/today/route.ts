// apps/web/src/app/api/staff/shift/today/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        const { supabase, staffId } = await getStaffContext();

        // Получаем проценты из настроек сотрудника
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            console.error('Error loading staff for percent:', staffError);
        }

        const staffPercentMaster = Number(staffData?.percent_master ?? 60);
        const staffPercentSalon = Number(staffData?.percent_salon ?? 40);

        // Текущая дата в локальной TZ (без времени)
        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        // Текущая смена
        const { data: shift, error: shiftError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (shiftError) {
            console.error('Error loading today shift:', shiftError);
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
                .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: true });

            if (itemsError) {
                console.error('Error loading shift items:', itemsError);
            } else {
                items = itemsData ?? [];
            }
        }

        // Записи (bookings) сотрудника за сегодня для выбора клиентов
        const todayStart = `${ymd}T00:00:00`;
        const todayEnd = `${ymd}T23:59:59`;
        const { data: todayBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru)')
            .eq('staff_id', staffId)
            .gte('start_at', todayStart)
            .lte('start_at', todayEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true });

        if (bookingsError) {
            console.error('Error loading today bookings:', bookingsError);
        }

        // Общая статистика по всем закрытым сменам сотрудника
        const { data: allShifts, error: statsError } = await supabase
            .from('staff_shifts')
            .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes')
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });

        if (statsError) {
            console.error('Error loading shifts stats:', statsError);
            return NextResponse.json(
                { ok: false, error: statsError.message },
                { status: 500 }
            );
        }

        const closed = (allShifts ?? []).filter((s) => s.status === 'closed');
        const totalAmount = closed.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        const totalMaster = closed.reduce((sum, s) => sum + Number(s.master_share || 0), 0);
        const totalSalon = closed.reduce((sum, s) => sum + Number(s.salon_share || 0), 0);
        const totalLateMinutes = closed.reduce((sum, s) => sum + Number(s.late_minutes || 0), 0);

        return NextResponse.json({
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
            bookings: todayBookings ?? [],
            stats: {
                totalAmount,
                totalMaster,
                totalSalon,
                totalLateMinutes,
                shiftsCount: closed.length,
            },
        });
    } catch (error) {
        console.error('Unexpected error in /api/staff/shift/today:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}


