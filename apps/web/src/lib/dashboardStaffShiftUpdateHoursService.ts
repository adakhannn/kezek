import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError } from '@/lib/log';

type ShiftRecord = {
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
};

export type DashboardShiftHoursAdminLike = {
  from: (table: string) => {
    update: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        select: (...args: unknown[]) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

export type UpdateShiftHoursResult =
  | { ok: true; data: { shift: Record<string, unknown> } }
  | {
      ok: false;
      error: 'validation' | 'not_found' | 'internal';
      message: string;
      status: number;
    };

export async function updateDashboardShiftHours(params: {
  admin: DashboardShiftHoursAdminLike;
  bizId: string;
  shiftId: string;
  hoursWorked: number;
}): Promise<UpdateShiftHoursResult> {
  const { admin, bizId, shiftId, hoursWorked } = params;

  const shiftCheck = await checkResourceBelongsToBiz<ShiftRecord>(
    admin as never,
    'staff_shifts',
    shiftId,
    bizId,
    'id,biz_id,staff_id,status,total_amount,consumables_amount,percent_master,percent_salon,hourly_rate,guaranteed_amount,master_share,salon_share,topup_amount',
  );

  if (shiftCheck.error || !shiftCheck.data) {
    return {
      ok: false,
      error: 'not_found',
      message: 'Смена не найдена или доступ запрещен',
      status: 404,
    };
  }

  const shift = shiftCheck.data;
  if (shift.status !== 'closed') {
    return {
      ok: false,
      error: 'validation',
      message: 'Можно изменять только закрытые смены',
      status: 400,
    };
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
    return {
      ok: false,
      error: 'internal',
      message: updateError?.message || 'Не удалось обновить смену',
      status: 500,
    };
  }

  return {
    ok: true,
    data: { shift: updated },
  };
}
