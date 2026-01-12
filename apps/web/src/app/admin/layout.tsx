import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminNav } from './_components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) авторизация
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin');

    // 2) проверка роли super_admin глобально (biz_id IS NULL)
    const { data: superRow, error: roleErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    const isSuper = !!superRow;

    if (roleErr || !isSuper) {
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold">403</h1>
                <p className="text-gray-600">Нет доступа (нужен супер-админ)</p>
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
