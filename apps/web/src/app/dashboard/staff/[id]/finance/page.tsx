import { notFound } from 'next/navigation';

import StaffFinancePageClient from './StaffFinancePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
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

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error } = await supabase
            .from('staff')
            .select('id, biz_id, full_name')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            logError('StaffFinancePage', 'Error loading staff', { 
                error: error.message, 
                staffId: id,
                bizId 
            });
            return notFound();
        }

        if (!staff) {
            logDebug('StaffFinancePage', 'Staff not found', { staffId: id, bizId });
            return notFound();
        }

        // Нормализуем значения для надежного сравнения (консистентно с API роутами)
        const normalizedBizId = bizId ? String(bizId).trim() : null;
        const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

        // Проверяем принадлежность к бизнесу
        if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
            logError('StaffFinancePage', 'Staff business mismatch', {
                staffId: id,
                staffBizId: normalizedStaffBizId,
                requestedBizId: normalizedBizId,
                staffBizIdType: typeof staff.biz_id,
                bizIdType: typeof bizId,
            });
            return notFound();
        }

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

