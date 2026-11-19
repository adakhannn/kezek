// apps/web/src/app/dashboard/branches/page.tsx  (или ваш путь)
import { getT } from '@/app/_components/i18n/server';
import BranchesListClient from '@/app/dashboard/branches/BranchesListClient';
import { getBizContextForManagers } from '@/lib/authBiz';

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
        const t = await getT();
        return <main className="p-6 text-red-600">{t('branches.error', 'Ошибка')}: {error.message}</main>;
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
