// apps/web/src/app/api/dashboard/staff-shifts/[id]/update-hours/route.ts
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
    hours_worked: number;
};

export async function POST(req: Request, context: unknown) {
    try {
        const shiftId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        let body: Body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('[dashboard/staff-shifts/update-hours] Invalid JSON body', e);
            return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
        }

        const rawHours = Number(body.hours_worked);
        if (!Number.isFinite(rawHours) || rawHours < 0 || rawHours > 24 * 2) {
            return NextResponse.json(
                { ok: false, error: 'INVALID_HOURS_VALUE' },
                { status: 400 }
            );
        }

        // Округляем до двух знаков после запятой
        const hoursWorked = Math.round(rawHours * 100) / 100;

        // Загружаем смену и проверяем, что она принадлежит бизнесу владельца
        const { data: shift, error: shiftError } = await admin
            .from('staff_shifts')
            .select(
                'id,biz_id,staff_id,status,total_amount,consumables_amount,percent_master,percent_salon,hourly_rate,guaranteed_amount,master_share,salon_share,topup_amount'
            )
            .eq('id', shiftId)
            .maybeSingle();

        if (shiftError) {
            console.error('[dashboard/staff-shifts/update-hours] Error loading shift', shiftError);
            return NextResponse.json(
                { ok: false, error: shiftError.message },
                { status: 500 }
            );
        }

        if (!shift || String(shift.biz_id) !== String(bizId)) {
            return NextResponse.json(
                { ok: false, error: 'SHIFT_NOT_FOUND_OR_FORBIDDEN' },
                { status: 404 }
            );
        }

        if (shift.status !== 'closed') {
            return NextResponse.json(
                { ok: false, error: 'ONLY_CLOSED_SHIFTS_CAN_BE_ADJUSTED' },
                { status: 400 }
            );
        }

        const totalAmount = Number(shift.total_amount ?? 0);
        const consumablesAmount = Number(shift.consumables_amount ?? 0);
        const percentMasterRaw = Number(shift.percent_master ?? 60);
        const percentSalonRaw = Number(shift.percent_salon ?? 40);

        const safePercentMaster = Number.isFinite(percentMasterRaw) ? percentMasterRaw : 60;
        const safePercentSalon = Number.isFinite(percentSalonRaw) ? percentSalonRaw : 40;
        const percentSum = safePercentMaster + safePercentSalon || 100;

        const normalizedMaster = (safePercentMaster / percentSum) * 100;
        const normalizedSalon = (safePercentSalon / percentSum) * 100;

        // Базовая доля сотрудника и бизнеса от выручки
        const baseMasterShare = Math.round((totalAmount * normalizedMaster) / 100);
        const baseSalonShareFromAmount = Math.round((totalAmount * normalizedSalon) / 100);
        const baseSalonShare = baseSalonShareFromAmount + consumablesAmount;

        const hourlyRate = shift.hourly_rate ? Number(shift.hourly_rate) : null;

        let guaranteedAmount = 0;
        if (hourlyRate && hourlyRate > 0 && hoursWorked > 0) {
            guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
        }

        let finalMasterShare = baseMasterShare;
        let finalSalonShare = baseSalonShare;
        let topupAmount = 0;

        if (guaranteedAmount > baseMasterShare) {
            finalMasterShare = guaranteedAmount;
            topupAmount = Math.round((guaranteedAmount - baseMasterShare) * 100) / 100;
            finalSalonShare = Math.max(0, baseSalonShare - topupAmount);
        }

        const { data: updated, error: updateError } = await admin
            .from('staff_shifts')
            .update({
                hours_worked: hoursWorked,
                guaranteed_amount: guaranteedAmount,
                master_share: finalMasterShare,
                salon_share: finalSalonShare,
                topup_amount: topupAmount,
                updated_at: new Date().toISOString(),
            })
            .eq('id', shiftId)
            .select('*')
            .maybeSingle();

        if (updateError || !updated) {
            console.error(
                '[dashboard/staff-shifts/update-hours] Error updating shift',
                updateError
            );
            return NextResponse.json(
                { ok: false, error: updateError?.message || 'UPDATE_FAILED' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            shift: updated,
        });
    } catch (e) {
        console.error('[dashboard/staff-shifts/update-hours] Unexpected error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}


