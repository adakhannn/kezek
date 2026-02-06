import { notFound } from 'next/navigation';

import StaffFinanceStatsPageClient from './StaffFinanceStatsPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinanceStatsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, что сотрудник принадлежит этому бизнесу
    const { data: staff, error } = await supabase
        .from('staff')
        .select('id, biz_id, full_name')
        .eq('id', id)
        .maybeSingle();

    if (error || !staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }

    return <StaffFinanceStatsPageClient id={id} fullName={staff.full_name} />;
}

