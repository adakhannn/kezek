import StaffPageClient from './StaffPageClient';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logWarn } from '@/lib/log';
import { loadStaffApplicationSummary } from '@/lib/staffApplicationSummary';
import { listPendingInvitationStaffIds } from '@/lib/staffInvitationService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    // join объектом, а не массивом
    branches: { name: string } | null;
};

export default async function Page({
                                       // ВАЖНО: в проекте searchParams это Promise<...>
                                       searchParams,
                                   }: {
    searchParams?: Promise<{ dismissed?: string | string[] }>;
}) {
    const { supabase, bizId, business, userId } = await getBizContextForManagers();
    const staffApplications = await loadStaffApplicationSummary(userId, bizId);

    // распаковываем и нормализуем dismissed
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    const dismissedParam = Array.isArray(sp.dismissed) ? sp.dismissed[0] : sp.dismissed;
    const showDismissed = dismissedParam === '1';

    const { data: rows, error } = await supabase
        .from('staff')
        .select('id,full_name,is_active,branch_id,branches(name)')
        .eq('biz_id', bizId)
        .order('full_name')
        .returns<Row[]>();

    if (error) {
        return (
            <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
                <AlertBanner variant="danger" message={error.message} />
            </main>
        );
    }

    // Cards waiting for the invited person (API-06). The table is service role only; the manager's
    // business context was resolved above, and the query is limited to that business.
    let pendingInvitationStaffIds: string[] = [];
    try {
        const pending = await listPendingInvitationStaffIds(createSupabaseAdminClient(), bizId);
        if (pending.ok) pendingInvitationStaffIds = pending.staffIds;
        else logWarn('StaffPage', 'Pending invitations unavailable');
    } catch {
        logWarn('StaffPage', 'Pending invitations unavailable');
    }

    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    return (
        <StaffPageClient
            staffApplications={staffApplications}
            initialRows={rows ?? []}
            pendingInvitationStaffIds={pendingInvitationStaffIds}
            showDismissed={showDismissed}
            bizName={bizName}
            bizCity={bizCity}
        />
    );
}


