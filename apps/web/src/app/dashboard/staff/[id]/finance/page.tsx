import { notFound } from 'next/navigation';

import StaffFinancePageClient from './StaffFinancePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError, logDebug } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinancePage({
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
            // Не раскрываем причину пользователю; для UX это 404
            if (staffResult.error === 'Resource not found') {
                logDebug('StaffFinancePage', 'Staff not found', { staffId: id, bizId });
            } else {
                logError('StaffFinancePage', 'Staff business check failed', { staffId: id, bizId, error: staffResult.error });
            }
            return notFound();
        }

        const staff = staffResult.data;

        // Без server-prefetch: данные смены загрузит клиент через /api/staff/finance
        return <StaffFinancePageClient id={id} fullName={staff.full_name} />;
    } catch (e) {
        // Если getBizContextForManagers выбросил ошибку, она будет обработана в layout
        // Но на всякий случай логируем здесь
        if (e instanceof Error && e.message !== 'NO_BIZ_ACCESS' && e.message !== 'UNAUTHORIZED') {
            logError('StaffFinancePage', 'Unexpected error', e);
        }
        // Пробрасываем ошибку дальше, чтобы layout мог её обработать
        throw e;
    }
}

