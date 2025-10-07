// apps/web/src/app/admin/businesses/[id]/branches/new/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { BranchForm } from '@/components/admin/branches/BranchForm';

export const dynamic = 'force-dynamic';

export default async function BranchNewPage({ params }: { params: { id: string } }) {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const { data:isSuper } = await supa.rpc('is_super_admin');
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);
    const { data: biz } = await admin.from('businesses').select('id,name').eq('id', params.id).maybeSingle();

    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">Новый филиал — {biz.name}</h1>
            <BranchForm mode="create" bizId={biz.id} />
        </div>
    );
}
