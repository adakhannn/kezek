// apps/web/src/app/api/dashboard/staff/finance/all/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

export async function GET(req: Request) {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const date = searchParams.get('date') || formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

        // Определяем диапазон дат в зависимости от периода
        let dateFrom: string;
        let dateTo: string;

        if (period === 'day') {
            dateFrom = date;
            dateTo = date;
        } else if (period === 'month') {
            // Первый и последний день месяца
            const [year, month] = date.split('-');
            dateFrom = `${year}-${month}-01`;
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            dateTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        } else {
            // Год
            const year = date.split('-')[0];
            dateFrom = `${year}-01-01`;
            dateTo = `${year}-12-31`;
        }

        // Получаем всех сотрудников бизнеса
        const { data: staffList, error: staffError } = await supabase
            .from('staff')
            .select('id, full_name, is_active')
            .eq('biz_id', bizId)
            .order('full_name');

        if (staffError) {
            console.error('Error loading staff:', staffError);
            return NextResponse.json(
                { ok: false, error: staffError.message },
                { status: 500 }
            );
        }

        // Получаем все смены за период
        const { data: allShifts, error: shiftsError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .gte('shift_date', dateFrom)
            .lte('shift_date', dateTo)
            .order('shift_date', { ascending: false });

        if (shiftsError) {
            console.error('Error loading shifts:', shiftsError);
            return NextResponse.json(
                { ok: false, error: shiftsError.message },
                { status: 500 }
            );
        }

        // Группируем смены по сотрудникам и считаем статистику
        const staffStats = (staffList || []).map((staff) => {
            const staffShifts = (allShifts || []).filter((s) => s.staff_id === staff.id);
            const closedShifts = staffShifts.filter((s) => s.status === 'closed');
            const openShifts = staffShifts.filter((s) => s.status === 'open');

            let totalAmount = 0;
            let totalMaster = 0;
            let totalSalon = 0;
            let totalConsumables = 0;
            let totalLateMinutes = 0;

            // Считаем только закрытые смены для итогов
            for (const shift of closedShifts) {
                totalAmount += Number(shift.total_amount ?? 0);
                totalMaster += Number(shift.master_share ?? 0);
                totalSalon += Number(shift.salon_share ?? 0);
                totalConsumables += Number(shift.consumables_amount ?? 0);
                totalLateMinutes += Number(shift.late_minutes ?? 0);
            }

            // Для открытых смен тоже считаем текущие значения
            for (const shift of openShifts) {
                totalAmount += Number(shift.total_amount ?? 0);
                totalMaster += Number(shift.master_share ?? 0);
                totalSalon += Number(shift.salon_share ?? 0);
                totalConsumables += Number(shift.consumables_amount ?? 0);
                totalLateMinutes += Number(shift.late_minutes ?? 0);
            }

            return {
                staffId: staff.id,
                staffName: staff.full_name,
                isActive: staff.is_active,
                shiftsCount: staffShifts.length,
                openShiftsCount: openShifts.length,
                closedShiftsCount: closedShifts.length,
                totalAmount,
                totalMaster,
                totalSalon,
                totalConsumables,
                totalLateMinutes,
            };
        });

        // Считаем общую статистику
        const totalStats = {
            totalAmount: staffStats.reduce((sum, s) => sum + s.totalAmount, 0),
            totalMaster: staffStats.reduce((sum, s) => sum + s.totalMaster, 0),
            totalSalon: staffStats.reduce((sum, s) => sum + s.totalSalon, 0),
            totalConsumables: staffStats.reduce((sum, s) => sum + s.totalConsumables, 0),
            totalLateMinutes: staffStats.reduce((sum, s) => sum + s.totalLateMinutes, 0),
            totalShifts: staffStats.reduce((sum, s) => sum + s.shiftsCount, 0),
            totalOpenShifts: staffStats.reduce((sum, s) => sum + s.openShiftsCount, 0),
            totalClosedShifts: staffStats.reduce((sum, s) => sum + s.closedShiftsCount, 0),
        };

        return NextResponse.json({
            ok: true,
            period,
            dateFrom,
            dateTo,
            staffStats,
            totalStats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[dashboard/staff/finance/all] error:', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

