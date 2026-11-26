import StaffPageClient from './StaffPageClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardStaffList } from '@/lib/dashboardStaffReadService';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({
                                       // ВАЖНО: в проекте searchParams это Promise<...>
                                       searchParams,
                                   }: {
    searchParams?: Promise<{ dismissed?: string | string[] }>;
}) {
    const { supabase, bizId, business, userId } = await getBizContextForManagers();

    // распаковываем и нормализуем dismissed
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    const dismissedParam = Array.isArray(sp.dismissed) ? sp.dismissed[0] : sp.dismissed;
    const showDismissed = dismissedParam === '1';

    // The same read serves GET /api/dashboard/staff (the mobile app).
    const list = await loadDashboardStaffList({ supabase, bizId, userId });
    if (!list.ok) {
        return <LoadFailedNotice page />;
    }

    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    return (
        <StaffPageClient
            staffApplications={list.data.staffApplications}
            initialRows={list.data.rows}
            pendingInvitationStaffIds={list.data.pendingInvitationStaffIds}
            showDismissed={showDismissed}
            bizName={bizName}
            bizCity={bizCity}
        />
    );
}
