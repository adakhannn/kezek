// apps/web/src/app/api/dashboard/staff-shifts/[id]/update-hours/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
    hours_worked: number;
};

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('UpdateShiftHours', async () => {
        const shiftId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        let body: Body;
        try {
            body = await req.json();
        } catch (e) {
            logError('UpdateShiftHours', 'Invalid JSON body', e);
            return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
        }

        const rawHours = Number(body.hours_worked);
        if (!Number.isFinite(rawHours) || rawHours < 0 || rawHours > 24 * 2) {
            return createErrorResponse('validation', 'Количество часов должно быть от 0 до 48', undefined, 400);
        }

        // Округляем до двух знаков после запятой
        const hoursWorked = Math.round(rawHours * 100) / 100;

        // Загружаем смену и проверяем, что она принадлежит бизнесу владельца (используем унифицированную утилиту)
        const shiftCheck = await checkResourceBelongsToBiz<{
            id: string;
            biz_id: string;
            staff_id: string;
            status: string;
            total_amount: number;
            consumables_amount: number;
            percent_master: number;
            percent_salon: number;
            hourly_rate: number | null;
            guaranteed_amount: number;
            master_share: number;
            salon_share: number;
            topup_amount: number;
        }>(
            admin,
            'staff_shifts',
            shiftId,
            bizId,
            'id,biz_id,staff_id,status,total_amount,consumables_amount,percent_master,percent_salon,hourly_rate,guaranteed_amount,master_share,salon_share,topup_amount'
        );
        if (shiftCheck.error || !shiftCheck.data) {
            return createErrorResponse('not_found', 'Смена не найдена или доступ запрещен', undefined, 404);
        }

        const shift = shiftCheck.data;

        if (shift.status !== 'closed') {
            return createErrorResponse('validation', 'Можно изменять только закрытые смены', undefined, 400);
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
            logError('UpdateShiftHours', 'Error updating shift', updateError);
            return createErrorResponse('internal', updateError?.message || 'Не удалось обновить смену', undefined, 500);
        }

        return createSuccessResponse({ shift: updated });
    });
}


