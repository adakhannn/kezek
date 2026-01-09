// apps/web/src/app/staff/schedule/page.tsx
import { notFound } from 'next/navigation';

import StaffSchedulePageClient from './StaffSchedulePageClient';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string; is_active: boolean };

export default async function StaffSchedulePage() {
    const { supabase, staffId, bizId, branchId } = await getStaffContext();

    // Информация о сотруднике
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', staffId)
        .maybeSingle();

    if (eStaff) {
        return <main className="p-6 text-red-600">Ошибка: {eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) return notFound();

    // Филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) {
        return <main className="p-6 text-red-600">Ошибка филиалов: {eBranches.message}</main>;
    }

    const activeBranches: Branch[] = (branches ?? []).filter((b) => b.is_active);

    return (
        <StaffSchedulePageClient
            bizId={String(bizId)}
            staffId={String(staff.id)}
            branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
            homeBranchId={String(staff.branch_id)}
        />
    );
}

