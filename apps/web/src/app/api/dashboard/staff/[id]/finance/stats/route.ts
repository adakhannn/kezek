// apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: staffId } = await params;
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const date = searchParams.get('date') || formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id, full_name')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError || !staff || String(staff.biz_id) !== String(bizId)) {
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

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

        // Получаем смены за период
        const { data: shifts, error: shiftsError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
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

        // Считаем статистику
        const closedShifts = shifts?.filter(s => s.status === 'closed') || [];
        const openShifts = shifts?.filter(s => s.status === 'open') || [];

        const stats = {
            period,
            dateFrom,
            dateTo,
            staffName: staff.full_name,
            shiftsCount: shifts?.length || 0,
            openShiftsCount: openShifts.length,
            closedShiftsCount: closedShifts.length,
            totalAmount: 0, // Общий оборот
            totalMaster: 0, // Доля сотрудника
            totalSalon: 0, // Доля бизнеса
            totalConsumables: 0, // Расходники
            totalLateMinutes: 0,
            shifts: shifts?.map(s => ({
                id: s.id,
                shift_date: s.shift_date,
                status: s.status,
                opened_at: s.opened_at,
                closed_at: s.closed_at,
                total_amount: Number(s.total_amount ?? 0),
                consumables_amount: Number(s.consumables_amount ?? 0),
                master_share: Number(s.master_share ?? 0),
                salon_share: Number(s.salon_share ?? 0),
                late_minutes: Number(s.late_minutes ?? 0),
            })) || [],
        };

        // Суммируем только закрытые смены
        for (const shift of closedShifts) {
            stats.totalAmount += Number(shift.total_amount ?? 0);
            stats.totalMaster += Number(shift.master_share ?? 0);
            stats.totalSalon += Number(shift.salon_share ?? 0);
            stats.totalConsumables += Number(shift.consumables_amount ?? 0);
            stats.totalLateMinutes += Number(shift.late_minutes ?? 0);
        }

        // Для открытых смен считаем текущие значения
        for (const shift of openShifts) {
            // Для открытых смен используем текущие значения из shift
            stats.totalAmount += Number(shift.total_amount ?? 0);
            stats.totalMaster += Number(shift.master_share ?? 0);
            stats.totalSalon += Number(shift.salon_share ?? 0);
            stats.totalConsumables += Number(shift.consumables_amount ?? 0);
            stats.totalLateMinutes += Number(shift.late_minutes ?? 0);
        }

        return NextResponse.json({
            ok: true,
            stats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[dashboard/staff/finance/stats] error:', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

