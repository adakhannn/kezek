// apps/web/src/app/admin/roles/new/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import RolesNewClient from './RolesNewClient';

export const dynamic = 'force-dynamic';

export default async function NewRolePage() {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Новая роль</h1>
                <div>Не авторизован</div>
            </main>
        );
    }

    // НОВАЯ проверка супер-админа (глобальная роль)
    const { data: superRow, error: roleErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return <div className="p-4">Нет доступа</div>;
    }

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Создать роль
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Добавьте новую роль в систему
                            </p>
                        </div>
                        <Link href="/admin/roles">
                            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                К списку ролей
                            </button>
                        </Link>
                    </div>
                </section>

                <RolesNewClient baseURL={baseURL} />
            </div>
        </main>
    );
}
