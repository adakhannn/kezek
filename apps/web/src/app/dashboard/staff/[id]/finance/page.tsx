import { notFound } from 'next/navigation';

import StaffFinanceView from '@/app/staff/StaffFinanceView';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinancePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, что сотрудник принадлежит этому бизнесу
    const { data: staff, error } = await supabase
        .from('staff')
        .select('id, biz_id')
        .eq('id', id)
        .maybeSingle();

    if (error || !staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }

    return <StaffFinanceView staffId={id} />;
}

