import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminNav } from './_components/AdminNav';

import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';


export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const url  = getSupabaseUrl();
    const anon = getSupabaseAnonKey();
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) авторизация
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin');

    // 2) проверка роли super_admin глобально (biz_id IS NULL)
    const { isSuperAdmin: isSuper, error: roleErr } = await checkCurrentUserIsSuperAdmin(
        supabase as unknown as SuperAdminRoleClient,
        user.id,
    );

    if (roleErr || !isSuper) {
        return (
            <main className="min-h-[calc(100vh-9rem)] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.18),transparent_32%)] px-4 py-10 sm:px-6 lg:px-8">
                <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-2xl shadow-purple-950/30 ring-1 ring-purple-500/20 backdrop-blur">
                    <div className="relative p-6 sm:p-10">
                        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />

                        <div className="relative space-y-8">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-pink-500/25">
                                    <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7m0 8h.01M5.07 19h13.86a2 2 0 0 0 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.34 16a2 2 0 0 0 1.73 3Z" />
                                    </svg>
                                </div>

                                <div className="space-y-3">
                                    <div className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                                        Доступ ограничен
                                    </div>
                                    <div className="space-y-2">
                                        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                                            Нужны права супер-админа
                                        </h1>
                                        <p className="max-w-2xl text-base leading-7 text-slate-300">
                                            Этот раздел доступен только супер-администраторам Kezek. Ваш аккаунт авторизован,
                                            но у него нет нужной роли для просмотра админки.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 text-sm text-slate-300 sm:grid-cols-[auto_1fr]">
                                <span className="font-semibold text-slate-100">Текущий аккаунт</span>
                                <span className="break-all">{user.email ?? 'Email не указан'}</span>
                                <span className="font-semibold text-slate-100">Требуется роль</span>
                                <span>global `super_admin`</span>
                            </div>

                            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100">
                                Если вы должны видеть админку, попросите действующего супер-админа выдать роль этому аккаунту.
                                Если вошли не под тем пользователем — выйдите и авторизуйтесь заново.
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link
                                    href="/cabinet/profile"
                                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition hover:scale-[1.01] hover:shadow-pink-500/30"
                                >
                                    Перейти в личный кабинет
                                </Link>
                                <Link
                                    href="/auth/sign-in"
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-600 bg-slate-900 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800"
                                >
                                    Войти под другим аккаунтом
                                </Link>
                                <Link
                                    href="/"
                                    className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-slate-300 transition hover:text-white"
                                >
                                    На главную
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            {/* Шапка навигации */}
            <header className="sticky top-0 z-[100] border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin" className="flex items-center gap-2 group">
                                <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg group-hover:shadow-lg transition-all duration-200">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                    Админка
                                </h1>
                            </Link>
                        </div>
                        <AdminNav />
                    </div>
                </div>
            </header>
            
            {/* Контент */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </div>
        </div>
    );
}
