// apps/web/src/app/admin/businesses/[id]/members/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import MembersClient from './MembersClient';

export const dynamic = 'force-dynamic';

import { isUuid } from '@/lib/validation';

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id || !isUuid(id)) {
        return (
            <main className="p-4">
                <div className="text-red-600">Некорректный business id</div>
            </main>
        );
    }

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) auth
    const {
        data: { user },
    } = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4">
                <div>Не авторизован</div>
            </main>
        );
    }

    // 2) Права: разделяем на просмотр и управление
    const { data: superRow } = await supa
        .from('user_roles_with_user')
        .select('user_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    // право на просмотр: супер или владелец/админ
    const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: id });
    const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: id });

    const canView = !!superRow || !!isOwner || !!isAdmin;
    if (!canView) {
        return (
            <main className="p-4">
                <div>Нет доступа</div>
            </main>
        );
    }

    // право на управление: только владелец/админ (без супера)
    const canManage = !!isOwner || !!isAdmin;

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    // Получаем информацию о бизнесе для заголовка
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(URL, SERVICE);
    const { data: biz } = await admin
        .from('businesses')
        .select('id,name')
        .eq('id', id)
        .maybeSingle();

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            Участники бизнеса
                        </h1>
                        {biz && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Бизнес: <span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={`/admin/businesses/${id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            К бизнесу
                        </Link>
                        {canManage && (
                            <Link
                                href={`/admin/businesses/${id}/members/new`}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Добавить участника
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Список участников */}
            <MembersClient baseURL={baseURL} bizId={id} canManage={canManage} />
        </div>
    );
}
