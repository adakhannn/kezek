// apps/web/src/app/admin/users/[id]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { UserBasicForm } from '@/components/admin/users/UserBasicForm';           // client-компонент (как было)
import { UserSecurityActions } from '@/components/admin/users/UserSecurityActions'; // client-компонент (как было)

export const dynamic = 'force-dynamic';

type Biz = { id: string; name: string; slug: string | null };

export default async function UserPage(ctx: unknown) {
    // params
    const params =
        typeof ctx === 'object' && ctx !== null && 'params' in ctx
            ? (ctx as { params: Record<string, string> }).params
            : {};
    const id = params.id;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    // кто вызывает
    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // доступ: только глобальный супер
    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">Ошибка: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">Нет доступа</div>;

    // сервис-клиент
    const admin = createClient(URL, SERVICE);

    // auth user
    const { data: got, error: eGet } = await admin.auth.admin.getUserById(id);
    if (eGet) return <div className="p-4">Ошибка: {eGet.message}</div>;
    const u = got?.user;
    if (!u) return <div className="p-4">Пользователь не найден</div>;

    // профиль
    const { data: prof } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', id)
        .maybeSingle<{ full_name: string | null }>();

    // сам пользователь — супер?
    const { data: suRow } = await admin
        .from('user_roles_with_user')
        .select('user_id')
        .eq('user_id', id)
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();
    const isSuperUser = !!suRow;

    // Бизнес(ы), где этот юзер — владелец (источник правды: businesses.owner_id)
    const { data: ownerBusinesses } = await admin
        .from('businesses')
        .select('id,name,slug')
        .eq('owner_id', id)
        .order('name')
        .returns<Biz[]>();

    // Все роли из вьюхи (кроме owner и super_admin — owner показываем отдельным блоком, super_admin глобален)
    const { data: viewRoles } = await admin
        .from('user_roles_with_user')
        .select('user_id,role_key,biz_id')
        .eq('user_id', id);

    // Подтянем названия бизнесов для ролей
    const bizIds = Array.from(
        new Set((viewRoles ?? []).map(r => r.biz_id).filter(Boolean) as string[])
    );
    let bizMap = new Map<string, { name: string; slug: string | null }>();
    if (bizIds.length) {
        const { data: relBiz } = await admin
            .from('businesses')
            .select('id,name,slug')
            .in('id', bizIds)
            .returns<Biz[]>();
        (relBiz ?? []).forEach(b => bizMap.set(b.id, { name: b.name, slug: b.slug ?? null }));
    }

    const roleBadges = (viewRoles ?? [])
        .filter(r => r.role_key !== 'super_admin' && r.role_key !== 'owner') // owner показываем отдельно
        .map((r, idx) => {
            const b = r.biz_id ? bizMap.get(r.biz_id) : null;
            return (
                <span
                    key={`${r.role_key}:${r.biz_id ?? 'global'}:${idx}`}
                    className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm"
                    title={r.biz_id ? (b ? `${b.name} (${b.slug ?? '—'})` : r.biz_id) : 'Глобальная роль'}
                >
          <span className="font-medium">{r.role_key}</span>
                    {r.biz_id && <span className="text-gray-500">/ {b?.name ?? r.biz_id}</span>}
        </span>
            );
        });

    // статус блокировки
    const { data: susp } = await admin
        .from('user_suspensions')
        .select('user_id')
        .eq('user_id', id)
        .limit(1)
        .maybeSingle();
    const isBlocked = !!susp;

    const userMeta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Пользователь</h1>
                <Link href="/admin/users" className="underline">← К списку</Link>
            </div>

            <section className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {/* Основные данные */}
                    <UserBasicForm
                        userId={id}
                        initial={{
                            full_name: prof?.full_name ?? userMeta.full_name ?? '',
                            email: u.email ?? '',
                            phone: (u as { phone?: string | null }).phone ?? '',
                        }}
                    />

                    {/* Блок «Владелец бизнеса» */}
                    <div className="rounded border p-4 space-y-2">
                        <h3 className="font-semibold">Владелец бизнеса</h3>
                        {ownerBusinesses && ownerBusinesses.length > 0 ? (
                            <ul className="list-disc pl-5">
                                {ownerBusinesses.map(b => (
                                    <li key={b.id}>
                                        <Link className="underline" href={`/admin/businesses/${b.id}`}>
                                            {b.name} {b.slug ? <span className="text-gray-500">({b.slug})</span> : null}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-500">Не владелец ни одного бизнеса.</div>
                        )}
                    </div>

                    {/* Блок «Роли пользователя» (read-only) */}
                    <div className="rounded border p-4 space-y-2">
                        <h3 className="font-semibold">Роли пользователя</h3>
                        <div className="flex flex-wrap gap-2">
                            {roleBadges.length ? roleBadges : (
                                <div className="text-sm text-gray-500">Ролей нет.</div>
                            )}
                        </div>
                        <div className="text-xs text-gray-500">
                            Роли назначаются владельцами внутри их бизнеса. Суперадмин назначает только владельца на странице бизнеса.
                        </div>
                    </div>
                </div>

                <aside className="space-y-4">
                    <UserSecurityActions userId={id} isSuper={isSuperUser} isBlocked={isBlocked} />
                </aside>
            </section>
        </main>
    );
}
