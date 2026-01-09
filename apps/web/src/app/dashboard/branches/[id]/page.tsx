import { notFound } from 'next/navigation';


// Временно скрыто
// import BranchAdminsPanel from "@/app/dashboard/branches/[id]/BranchAdminsPanel";
import EditBranchPageClient from './EditBranchPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditBranchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    const { data: branch, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active,biz_id,lat,lon')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return <main className="p-6 text-red-600">Ошибка: {error.message}</main>;
    }
    if (!branch || String(branch.biz_id) !== String(bizId)) return notFound();

    return (
        <EditBranchPageClient branch={branch} isSuperAdmin={isSuperAdmin} />
    );
}
