// apps/web/src/app/admin/businesses/[id]/owner/page.tsx
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';

import {OwnerForm} from './ui/OwnerForm';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    owner_id: string | null;
};

type OwnerInitial = { fullName: string; email: string; phone: string };

export default async function OwnerPage({params}: { params: { id: string } }) {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {
        data: {user},
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);

    const {data: biz, error: eBiz} = await admin
        .from('businesses')
        .select('id,name,owner_id')
        .eq('id', params.id)
        .maybeSingle<BizRow>();

    if (eBiz) return <div className="p-4">Ошибка: {eBiz.message}</div>;
    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    let initial: OwnerInitial = {fullName: '', email: '', phone: ''};

    if (biz.owner_id) {
        const {data, error} = await admin.auth.admin.getUserById(biz.owner_id);
        if (!error && data?.user) {
            const meta = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
            const phone = (data.user as { phone?: string | null }).phone ?? '';
            initial = {
                fullName: meta.full_name ?? '',
                email: data.user.email ?? '',
                phone,
            };
        }
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">
                {biz.owner_id ? 'Редактировать владельца' : 'Назначить владельца'}: {biz.name}
            </h1>
            <div className="border rounded p-3">
                <OwnerForm bizId={biz.id} initial={initial}/>
            </div>
        </div>
    );
}
