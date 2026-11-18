import type { BranchHoursRow } from './legacyDefaults';

import { logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type LegacyScheduleContext = {
    /** The staff member already has published schedule versions; legacy writes are refused for them. */
    usesPublishedSchedule: boolean;
    /** Home-branch hours, or null when they could not be read. */
    branchHours: BranchHoursRow[] | null;
    /** Weekly or range rules or working_hours exist, so a day without a date rule still has hours. */
    hasRegularSchedule: boolean;
};

/**
 * Reads what the legacy schedule editor needs with the service client, so owners, admins, managers
 * and super admins see the same data (branch_working_hours RLS hides it from admins and super
 * admins). The caller must already have checked that a manager of bizId asks for a staff member
 * of bizId (getBizContextForManagers + staff.biz_id).
 */
export async function readLegacyScheduleContext(bizId: string, staffId: string, homeBranchId: string): Promise<LegacyScheduleContext> {
    const admin = getServiceClient();
    const [versions, branchHours, regularRules, workingHours] = await Promise.all([
        admin.from('staff_schedule_versions').select('id', { count: 'exact', head: true }).eq('staff_id', staffId),
        admin.from('branch_working_hours').select('day_of_week, intervals').eq('biz_id', bizId).eq('branch_id', homeBranchId),
        admin.from('staff_schedule_rules').select('id', { count: 'exact', head: true })
            .eq('staff_id', staffId).eq('is_active', true).in('kind', ['weekly', 'range']),
        admin.from('working_hours').select('id', { count: 'exact', head: true }).eq('staff_id', staffId),
    ]);

    for (const [name, result] of [['versions', versions], ['branch hours', branchHours], ['regular rules', regularRules], ['working hours', workingHours]] as const) {
        if (result.error) logError('LegacyScheduleContext', `Failed to read ${name}`, result.error);
    }

    return {
        usesPublishedSchedule: !versions.error && (versions.count ?? 0) > 0,
        branchHours: branchHours.error
            ? null
            : (branchHours.data ?? []).map((row) => ({
                day_of_week: row.day_of_week,
                intervals: Array.isArray(row.intervals) ? (row.intervals as BranchHoursRow['intervals']) : [],
            })),
        hasRegularSchedule: (regularRules.count ?? 0) + (workingHours.count ?? 0) > 0,
    };
}
