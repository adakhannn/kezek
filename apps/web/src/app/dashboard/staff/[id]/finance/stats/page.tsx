import { notFound } from 'next/navigation';

import StaffFinanceStatsPageClient from './StaffFinanceStatsPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError, logDebug } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinanceStatsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    try {
        const { id } = await params;
        const { supabase, bizId } = await getBizContextForManagers();

        // Проверяем, что сотрудник принадлежит этому бизнесу (общий хелпер)
        const staffResult = await checkResourceBelongsToBiz<{ id: string; biz_id: string | number | null; full_name: string | null }>(
            supabase,
            'staff',
            id,
            bizId,
            'id, biz_id, full_name'
        );

        if (staffResult.error || !staffResult.data) {
            if (staffResult.error === 'Resource not found') {
                logDebug('StaffFinanceStatsPage', 'Staff not found', { staffId: id, bizId });
            } else {
                logError('StaffFinanceStatsPage', 'Staff business check failed', { staffId: id, bizId, error: staffResult.error });
            }
            return notFound();
        }

        const staff = staffResult.data;
        return <StaffFinanceStatsPageClient id={id} fullName={staff.full_name} />;
    } catch (e) {
        if (e instanceof Error && e.message !== 'NO_BIZ_ACCESS' && e.message !== 'UNAUTHORIZED') {
            logError('StaffFinanceStatsPage', 'Unexpected error', e);
        }
        throw e;
    }
}

