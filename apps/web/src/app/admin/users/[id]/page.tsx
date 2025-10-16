// apps/web/src/app/admin/users/[id]/page.tsx
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import Link from 'next/link';

import {UserBasicForm} from '@/components/admin/users/UserBasicForm';
import {UserRolesEditor} from '@/components/admin/users/UserRolesEditor';
import {UserSecurityActions} from '@/components/admin/users/UserSecurityActions';

export const dynamic = 'force-dynamic';

type Biz = { id: string; name: string; slug: string };

type RoleJoinRow = {
    biz_id: string | null;
    roles: { key: string } | null; // join на roles
    businesses:
        | { name: string | null; slug: string | null }
        | { name: string | null; slug: string | null }[]
        | null;
};

type RoleRow = {
    biz_id: string | null;
    role: string; // role_key
    businesses?: { name: string | null; slug: string | null } | null;
};

export default async function UserPage({params}: { params: { id: string } }) {
    const id = params.id;

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

    // Сессия и доступ
    const {
        data: {user},
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // Проверка прав: глобальная роль super_admin из представления user_roles_with_user
    const {data: superRow, error: superErr} = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">Ошибка: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">Нет доступа</div>;

    // Админ-клиент
    const admin = createClient(URL, SERVICE);

    // Пользователь через Admin API
    const {data: got, error: eGet} = await admin.auth.admin.getUserById(id);
    if (eGet) return <div className="p-4">Ошибка: {eGet.message}</div>;
    const u = got?.user;
    if (!u) return <div className="p-4">Пользователь не найден</div>;

    // Профиль (поле full_name)
    const {data: prof} = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', id)
        .maybeSingle<{ full_name: string | null }>();

    // Супер-админ? — проверяем через view user_roles_with_user
    const {data: suRow} = await admin
        .from('user_roles_with_user')
        .select('user_id')
        .eq('user_id', id)
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();
    const isSuperUser = !!suRow;

    const {data: rawRoles} = await admin
        .from('user_roles')
        .select('biz_id, roles!inner(key), businesses(name,slug)')
        .eq('user_id', id)
        .returns<RoleJoinRow[]>();

    const roles: RoleRow[] = (rawRoles ?? []).map((r) => ({
        biz_id: r.biz_id, // может быть null у глобальных ролей
        role: r.roles?.key ?? '',
        businesses: Array.isArray(r.businesses) ? (r.businesses[0] ?? null) : r.businesses ?? null,
    }));

    // 👉 Роли для редактора: только «по бизнесам» (biz_id не null) и с biz_id как string
    const rolesForEditor = roles
        .filter((r) => r.biz_id) // убираем глобальные (super_admin и т.п.)
        .map((r) => ({
            biz_id: r.biz_id!,                 // теперь точно string
            role: r.role,
            businesses: r.businesses ?? null,
        }));

    // Все бизнесы
    const {data: allBiz} = await admin
        .from('businesses')
        .select('id,name,slug')
        .order('name')
        .returns<Biz[]>();

    // Метаданные пользователя
    const userMeta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Пользователь</h1>
                <Link href="/admin/users" className="underline">
                    ← К списку
                </Link>
            </div>

            <section className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                    <UserBasicForm
                        userId={id}
                        initial={{
                            full_name: prof?.full_name ?? userMeta.full_name ?? '',
                            email: u.email ?? '',
                            phone: (u as { phone?: string | null }).phone ?? '',
                        }}
                    />
                    <UserRolesEditor userId={id} roles={rolesForEditor} allBusinesses={allBiz ?? []}/>
                </div>

                <aside className="space-y-4">
                    <UserSecurityActions userId={id} isSuper={isSuperUser}/>
                </aside>
            </section>
        </main>
    );
}
