// apps/web/src/app/admin/businesses/[id]/branches/[branchId]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { BranchForm } from '@/components/admin/branches/BranchForm';

export const dynamic = 'force-dynamic';

type RouteParams = { id: string; branchId: string };

export default async function BranchEditPage(
    { params }: { params: Promise<RouteParams> }
) {
    const { id, branchId } = await params;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const { data: isSuper } = await supa.rpc('is_super_admin');
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);
    const { data: branch, error } = await admin
        .from('branches')
        .select('id,biz_id,name,address,is_active')
        .eq('biz_id', id)
        .eq('id', branchId)
        .maybeSingle();

    if (error) return <div className="p-4">Ошибка: {error.message}</div>;
    if (!branch) return <div className="p-4">Филиал не найден</div>;

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">Редактировать филиал</h1>
            <BranchForm
                mode="edit"
                bizId={branch.biz_id}
                branchId={branch.id}
                initial={{ name: branch.name, address: branch.address ?? '', is_active: !!branch.is_active }}
            />
        </div>
    );
}
