import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import NewMemberExisting from './NewMemberExisting';

import { isUuid } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export default async function NewMemberPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id || !isUuid(id)) {
        return <main className="p-4 text-red-600">Некорректный business id</main>;
    }

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <main className="p-4">Не авторизован</main>;

    // доступ: super_admin (global) ИЛИ owner/admin конкретного бизнеса
    const { data: superRow } = await supa
        .from('user_roles_with_user')
        .select('user_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    let allowed = !!superRow;
    if (!allowed) {
        const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: id });
        const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: id });
        allowed = !!isOwner || !!isAdmin;
    }
    if (!allowed) return <main className="p-4">Нет доступа</main>;

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
                            Добавить участника
                        </h1>
                        {biz && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Бизнес: <span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                            </p>
                        )}
                    </div>
                    <Link
                        href={`/admin/businesses/${id}/members`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        К участникам
                    </Link>
                </div>
            </div>

            {/* Форма поиска и добавления */}
            <NewMemberExisting baseURL={baseURL} bizId={id} />
        </div>
    );
}
