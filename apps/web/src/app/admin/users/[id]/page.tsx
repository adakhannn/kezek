// apps/web/src/app/admin/users/[id]/page.tsx
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import Link from 'next/link';

import {UserBasicForm} from '@/components/admin/users/UserBasicForm';
import {UserRolesEditor} from '@/components/admin/users/UserRolesEditor';
import {UserSecurityActions} from '@/components/admin/users/UserSecurityActions';

export const dynamic = 'force-dynamic';

type RoleRowJoin = {
    biz_id: string;
    role: string;
    businesses:
        | { name: string | null; slug: string | null }
        | { name: string | null; slug: string | null }[]
        | null;
};
type RoleRow = {
    biz_id: string;
    role: string;
    businesses?: { name: string | null; slug: string | null } | null;
};
type Biz = { id: string; name: string; slug: string };
type RouteParams = { id: string };
export default async function UserPage(
    {params}: { params: Promise<RouteParams> }
) {
    const {id} = await params;
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
    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    // Админ-клиент
    const admin = createClient(URL, SERVICE);

    // Пользователь через Admin API
    const {data: got, error: eGet} = await admin.auth.admin.getUserById(id);
    if (eGet) return <div className="p-4">Ошибка: {eGet.message}</div>;
    const u = got?.user;
    if (!u) return <div className="p-4">Пользователь не найден</div>;

    // Имя из profiles — ключевое: тип через maybeSingle<...>(), иначе TS может вывести never
    const {data: prof} = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', id)
        .maybeSingle<{ full_name: string | null }>();

    // Супер-админ?
    const {data: su} = await admin
        .from('super_admins')
        .select('user_id')
        .eq('user_id', id)
        .maybeSingle<{ user_id: string }>();
    const isSuperUser = !!su;

    // Роли
    const {data: rawRoles} = await admin
        .from('user_roles')
        .select('biz_id,role,businesses(name,slug)')
        .eq('user_id', id)
        .returns<RoleRowJoin[]>();

    const roles: RoleRow[] = (rawRoles ?? []).map((r) => ({
        biz_id: r.biz_id,
        role: r.role,
        businesses: Array.isArray(r.businesses) ? (r.businesses[0] ?? null) : r.businesses ?? null,
    }));

    // Все бизнесы
    const {data: allBiz} = await admin
        .from('businesses')
        .select('id,name,slug')
        .order('name')
        .returns<Biz[]>();

    // Аккуратно типизируем метаданные пользователя
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
                            phone: u.phone ?? '',
                        }}
                    />
                    <UserRolesEditor userId={id} roles={roles} allBusinesses={allBiz ?? []}/>
                </div>

                <aside className="space-y-4">
                    <UserSecurityActions userId={id} isSuper={isSuperUser}/>
                </aside>
            </section>
        </main>
    );
}

