import type { StaffOption } from '@/lib/authDiagnostics';
import { logWarn } from '@/lib/log';
import type { StaffOptionLabel } from '@/lib/staffSelection';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * Business and branch names of the caller's own staff cards for the chooser (ARCH-02). Read with
 * the service role: client RLS hides businesses that are not approved yet. The ids come from the
 * caller's own cards only. Never throws: without names the chooser shows a neutral label.
 */
export async function loadStaffOptionLabels(options: StaffOption[]): Promise<StaffOptionLabel[]> {
    const unnamed = options.map((option) => ({ ...option, businessName: null, branchName: null }));
    if (options.length === 0) return unnamed;

    try {
        const admin = getServiceClient();
        const bizIds = [...new Set(options.map((option) => option.bizId))];
        const branchIds = [...new Set(options.map((option) => option.branchId).filter((id): id is string => Boolean(id)))];
        const [businesses, branches] = await Promise.all([
            admin.from('businesses').select('id, name').in('id', bizIds),
            branchIds.length > 0
                ? admin.from('branches').select('id, name').in('id', branchIds)
                : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
        ]);
        if (businesses.error) throw businesses.error;
        if (branches.error) throw branches.error;

        const businessName = new Map((businesses.data ?? []).map((row) => [row.id, row.name ?? null]));
        const branchName = new Map((branches.data ?? []).map((row) => [row.id, row.name ?? null]));
        return options.map((option) => ({
            ...option,
            businessName: businessName.get(option.bizId) ?? null,
            branchName: option.branchId ? branchName.get(option.branchId) ?? null : null,
        }));
    } catch (error) {
        logWarn('StaffSelection', 'Failed to load staff card labels', {
            message: error instanceof Error ? error.message : String(error),
        });
        return unnamed;
    }
}
