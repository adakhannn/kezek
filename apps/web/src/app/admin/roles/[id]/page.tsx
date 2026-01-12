import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import Link from 'next/link';

import EditRoleClient from './EditRoleClient';

export const dynamic = 'force-dynamic';

export default async function RoleEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роль</h1>
                <div>Не авторизован</div>
            </main>
        );
    }

    const {data: superRow, error: roleErr} = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роль</h1>
                <div>Нет доступа</div>
            </main>
        );
    }

    const {data: role, error} = await supa
        .from('roles')
        .select('id,key,name,description,is_system')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return <main className="p-4">Ошибка: {error.message}</main>;
    }
    if (!role) {
        return <main className="p-4">Роль не найдена</main>;
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                    {role.name}
                                </h1>
                                {role.is_system && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" clipRule="evenodd" />
                                            <path fillRule="evenodd" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Системная
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                {role.key}
                            </p>
                        </div>
                        <Link href="/admin/roles">
                            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Назад к ролям
                            </button>
                        </Link>
                    </div>
                </section>

                <EditRoleClient role={role}/>
            </div>
        </main>
    );
}
