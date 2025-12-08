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
    const userMeta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;

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
    const bizMap = new Map<string, { name: string; slug: string | null }>();
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                    title={r.biz_id ? (b ? `${b.name} (${b.slug ?? '—'})` : r.biz_id) : 'Глобальная роль'}
                >
                    <span className="font-medium">{r.role_key}</span>
                    {r.biz_id && <span className="text-gray-500 dark:text-gray-400">/ {b?.name ?? r.biz_id}</span>}
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

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Пользователь</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление данными пользователя</p>
                    </div>
                    <Link href="/admin/users" className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        К списку
                    </Link>
                </div>
            </div>

            <section className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {/* Основные данные */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                        <UserBasicForm
                            userId={id}
                            initial={{
                                full_name: userMeta.full_name ?? '',
                                email: u.email ?? '',
                                phone: (u as { phone?: string | null }).phone ?? '',
                            }}
                        />
                    </div>

                    {/* Блок «Владелец бизнеса» */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Владелец бизнеса</h3>
                        {ownerBusinesses && ownerBusinesses.length > 0 ? (
                            <ul className="space-y-2">
                                {ownerBusinesses.map(b => (
                                    <li key={b.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <Link className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${b.id}`}>
                                            {b.name}
                                        </Link>
                                        {b.slug && <span className="text-gray-500 dark:text-gray-400 ml-2">({b.slug})</span>}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400">Не владелец ни одного бизнеса.</div>
                        )}
                    </div>

                    {/* Блок «Роли пользователя» (read-only) */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Роли пользователя</h3>
                        <div className="flex flex-wrap gap-2">
                            {roleBadges.length ? roleBadges.map((badge, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                                >
                                    {badge}
                                </span>
                            )) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Ролей нет.</div>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            Роли назначаются владельцами внутри их бизнеса. Суперадмин назначает только владельца на странице бизнеса.
                        </div>
                    </div>
                </div>

                <aside className="space-y-4">
                    <UserSecurityActions userId={id} isSuper={isSuperUser} isBlocked={isBlocked} />
                </aside>
            </section>
        </div>
    );
}
