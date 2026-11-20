// apps/web/src/app/dashboard/branches/page.tsx  (или ваш путь)
import BranchesListClient from '@/app/dashboard/branches/BranchesListClient';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
};

export default async function BranchesListPage() {
    const { supabase, userId, bizId, business } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    const { data: branches, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active')
        .eq('biz_id', bizId)
        .order('name');

    const branchLimit = business?.branch_limit ?? 1;
    const canManageBranches = isSuperAdmin || business?.owner_id === userId;
    const canCreateBranch = canManageBranches && (branches?.length ?? 0) < branchLimit;

    if (error) {
        logError('DashboardBranchesPage', 'Failed to load branches', { error });
        return <LoadFailedNotice page />;
    }

    return (
        <BranchesListClient
            branches={(branches ?? []) as Branch[]}
            canCreateBranch={canCreateBranch}
            businessSlug={business?.slug || null}
            businessName={business?.name || null}
            branchLimit={branchLimit}
        />
    );
}
