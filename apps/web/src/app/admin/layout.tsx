import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseServer } from '@/lib/authBiz';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await getSupabaseServer();

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
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <header className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold gradient-text">Админ-панель</h1>
                            <nav className="hidden md:flex items-center gap-2">
                                <Link className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200" href="/admin">Главная</Link>
                                <Link className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200" href="/admin/businesses">Бизнесы</Link>
                                <Link className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200" href="/admin/categories">Категории</Link>
                                <Link className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200" href="/admin/users">Пользователи</Link>
                                <Link className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200" href="/admin/roles">Роли</Link>
                            </nav>
                        </div>
                        <Link className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/">На сайт</Link>
                    </header>
                </div>
            </div>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </div>
        </div>
    );
}
