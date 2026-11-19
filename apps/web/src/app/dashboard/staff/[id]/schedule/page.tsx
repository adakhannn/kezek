import { notFound } from 'next/navigation';

import Client from './Client';
import StaffSchedulePageClient from './StaffSchedulePageClient';

import { getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import ScheduleEditor from '@/components/scheduling/ScheduleEditor';
import { getBizContextForManagers } from '@/lib/authBiz';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readLegacyScheduleContext } from '@/lib/scheduling/legacyContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string; is_active: boolean };

export default async function StaffSchedulePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId, business } = await getBizContextForManagers();

    // сотрудник
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', id)
        .maybeSingle();

    if (eStaff) {
        const t = await getT();
        return (
            <main className="p-6 text-red-600">
                {t('staff.schedule.error', 'Ошибка:')} {eStaff.message}
            </main>
        );
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) return notFound();

    // данные бизнеса для контекста
    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    // филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) {
        const t = await getT();
        return (
            <main className="p-6 text-red-600">
                {t('staff.schedule.error.branches', 'Ошибка филиалов:')} {eBranches.message}
            </main>
        );
    }

    const activeBranches: Branch[] = (branches ?? []).filter((b): b is Branch => b.is_active === true);
    const explicitScheduling = explicitSchedulingEnabled();
    const legacyContext = explicitScheduling ? null : await readLegacyScheduleContext(String(bizId), String(staff.id), String(staff.branch_id));

    return (
        <main className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <StaffSchedulePageClient
                staffId={String(staff.id)}
                staffName={staff.full_name || ''}
                bizName={bizName}
                bizCity={bizCity}
            />

            {legacyContext?.failed ? <LoadFailedNotice /> : explicitScheduling || !legacyContext ? <ScheduleEditor
                staffId={String(staff.id)}
                branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
                homeBranchId={String(staff.branch_id)}
            /> : <Client
                bizId={String(bizId)}
                staffId={String(staff.id)}
                branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
                homeBranchId={String(staff.branch_id)}
                branchHours={legacyContext.branchHours}
                usesPublishedSchedule={legacyContext.usesPublishedSchedule}
                hasRegularSchedule={legacyContext.hasRegularSchedule}
            />}
        </main>
    );
}
