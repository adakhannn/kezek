import { calculateBaseShares, normalizePercentages } from '@core-domain/finance';
import { logError } from '@/lib/log';

export async function loadStaffPercentages(supabase: any, staffId: string) {
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('percent_master, percent_salon')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffShiftItems', 'Error loading staff for percent', staffError);
    }

    return {
        percentMaster: Number(staffData?.percent_master ?? 60),
        percentSalon: Number(staffData?.percent_salon ?? 40),
    };
}

export function calculateShiftPercentTotals(params: {
    consumablesAmount: number;
    percentMaster: number;
    percentSalon: number;
    totalAmount: number;
}) {
    const { consumablesAmount, percentMaster, percentSalon, totalAmount } = params;
    const normalized = normalizePercentages(percentMaster, percentSalon);
    const { masterShare, salonShare } = calculateBaseShares(
        totalAmount,
        consumablesAmount,
        percentMaster,
        percentSalon
    );

    return {
        consumablesAmount,
        masterShare,
        normalizedMaster: normalized.master,
        normalizedSalon: normalized.salon,
        salonShare,
        totalAmount,
    };
}
