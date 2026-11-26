import { notFound } from 'next/navigation';

import Client from './Client';
import StaffSchedulePageClient from './StaffSchedulePageClient';

import { getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import ScheduleEditor from '@/components/scheduling/ScheduleEditor';
import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardStaffScheduleContext } from '@/lib/dashboardStaffReadService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffSchedulePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId, business, userId } = await getBizContextForManagers();

    // Staff, active branches and the editor's server reads; the same read serves
    // GET /api/dashboard/staff/[id]/schedule-context (the mobile app).
    const context = await loadDashboardStaffScheduleContext({ supabase, bizId, userId }, id);
    if (!context.ok) {
        if (context.reason === 'not_found') return notFound();
        const t = await getT();
        return (
            <main className="p-6 text-red-600">
                {context.stage === 'branches'
                    ? t('staff.schedule.error.branches', 'Ошибка филиалов:')
                    : t('staff.schedule.error', 'Ошибка:')} {context.message}
            </main>
        );
    }
    const { staff, branches: activeBranches, explicitScheduling, legacy: legacyContext } = context.data;

    // данные бизнеса для контекста
    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    return (
        <main className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <StaffSchedulePageClient
                staffId={staff.id}
                staffName={staff.full_name}
                bizName={bizName}
                bizCity={bizCity}
            />

            {legacyContext?.failed ? <LoadFailedNotice /> : explicitScheduling || !legacyContext ? <ScheduleEditor
                staffId={staff.id}
                branches={activeBranches}
                homeBranchId={staff.branch_id}
            /> : <Client
                bizId={String(bizId)}
                staffId={staff.id}
                branches={activeBranches}
                homeBranchId={staff.branch_id}
                branchHours={legacyContext.branchHours}
                usesPublishedSchedule={legacyContext.usesPublishedSchedule}
                hasRegularSchedule={legacyContext.hasRegularSchedule}
            />}
        </main>
    );
}
