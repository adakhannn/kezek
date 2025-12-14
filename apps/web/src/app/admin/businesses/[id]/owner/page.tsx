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

    // 5) Список существующих пользователей через Admin API (только подтвержденные)
    const { data: listResp, error: eUsers } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });

    if (eUsers) {
        return <div className="p-4">Ошибка загрузки пользователей: {eUsers.message}</div>;
    }

    const allUsers = listResp?.users ?? [];
    
    // Фильтруем только подтвержденных пользователей (email_confirmed_at или phone_confirmed_at не null)
    const confirmedUsers = allUsers.filter((u) => {
        const hasEmail = u.email && u.email_confirmed_at;
        const hasPhone = (u as { phone?: string | null; phone_confirmed_at?: string | null }).phone && 
                        (u as { phone_confirmed_at?: string | null }).phone_confirmed_at;
        return hasEmail || hasPhone;
    });

    // Подтягиваем full_name из profiles
    const userIds = confirmedUsers.map((u) => u.id);
    const profiles: Record<string, { full_name: string | null }> = {};
    if (userIds.length > 0) {
        const { data: profRows } = await admin
            .from('profiles')
            .select('id,full_name')
            .in('id', userIds);
        for (const r of profRows ?? []) {
            profiles[r.id] = { full_name: r.full_name };
        }
    }

    // Проверяем заблокированных пользователей
    const userIdsForSuspension = confirmedUsers.map((u) => u.id);
    const suspendedMap = new Set<string>();
    if (userIdsForSuspension.length > 0) {
        const { data: suspensions } = await admin
            .from('user_suspensions')
            .select('user_id')
            .in('user_id', userIdsForSuspension);
        for (const s of suspensions ?? []) {
            suspendedMap.add(s.user_id);
        }
    }

    // Преобразуем в нужный формат
    const users: UserRow[] = confirmedUsers.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        phone: (u as { phone?: string | null }).phone ?? null,
        full_name: profiles[u.id]?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
        is_suspended: suspendedMap.has(u.id) ? true : null,
    }));

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
