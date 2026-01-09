// apps/web/src/app/dashboard/branches/page.tsx  (или ваш путь)
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
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    const { data: branches, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (error) {
        return <main className="p-6 text-red-600">Ошибка: {error.message}</main>;
    }

    return (
        <BranchesListClient branches={(branches ?? []) as Branch[]} isSuperAdmin={isSuperAdmin} />
    );
}
