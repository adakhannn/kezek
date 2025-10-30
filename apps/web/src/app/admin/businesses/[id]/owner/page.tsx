import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { OwnerForm } from './ui/OwnerForm';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    owner_id: string | null;
};

type UserRow = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    is_suspended: boolean | null;
};

type RouteParams = { id: string };

export default async function OwnerPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {},
        },
    });

    // 1) Авторизация
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) Проверка супера
    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    // 3) Сервисный клиент
    const admin = createClient(URL, SERVICE);

    // 4) Бизнес
    const { data: biz, error: eBiz } = await admin
        .from('businesses')
        .select('id,name,owner_id')
        .eq('id', id)
        .maybeSingle<BizRow>();

    if (eBiz) return <div className="p-4">Ошибка: {eBiz.message}</div>;
    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    // 5) Список существующих пользователей (до 200, можно добавить поиск/пагинацию)
    const { data: users, error: eUsers } = await admin
        .from('auth_users_view')
        .select('id,email,phone,full_name,is_suspended')
        .limit(200)
        .returns<UserRow[]>();

    if (eUsers) {
        return <div className="p-4">Ошибка загрузки пользователей: {eUsers.message}</div>;
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">
                Назначить владельца: {biz.name}
            </h1>
            <div className="border rounded p-3">
                <OwnerForm
                    bizId={biz.id}
                    users={users ?? []}
                    currentOwnerId={biz.owner_id}
                />
            </div>
        </div>
    );
}
