// apps/web/src/app/staff/schedule/page.tsx
import { notFound } from 'next/navigation';

import ExplicitStaffSchedule from './ExplicitStaffSchedule';
import StaffSchedulePageClient from './StaffSchedulePageClient';

import { getT } from '@/app/_components/i18n/server';
import { getStaffPageContext } from '@/lib/authBiz';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string; is_active: boolean };

export default async function StaffSchedulePage() {
    // The layout shows sign-in, the business chooser or the error; the page renders nothing then.
    const context = await getStaffPageContext();
    if (!context) return null;
    const { supabase, staffId, bizId } = context;

    // Информация о сотруднике
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', staffId)
        .maybeSingle();

    if (eStaff) {
        const t = await getT();
        return <main className="p-6 text-red-600">{t('staff.schedule.error', 'Ошибка:')} {eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) return notFound();

    // Филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) {
        const t = await getT();
        return <main className="p-6 text-red-600">{t('staff.schedule.error.branches', 'Ошибка филиалов:')} {eBranches.message}</main>;
    }

    const activeBranches: Branch[] = (branches ?? []).filter((b): b is Branch => b.is_active === true);

    if (explicitSchedulingEnabled()) return <ExplicitStaffSchedule branches={activeBranches} />;

    return (
        <StaffSchedulePageClient
            bizId={String(bizId)}
            staffId={String(staff.id)}
            branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
            homeBranchId={String(staff.branch_id)}
        />
    );
}

