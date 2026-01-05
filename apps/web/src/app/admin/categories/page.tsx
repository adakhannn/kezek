// apps/web/src/app/admin/categories/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { DeleteCategoryButton } from '@/components/admin/categories/DeleteCategoryButton';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

type CategoryUsageRow = {
    id: string;
    name_ru: string;
    slug: string;
    is_active: boolean;
    usage_count: number;
};

export default async function CategoriesPage() {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) Авторизация
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) Новая проверка супер-админа: роль 'super_admin' c biz_id IS NULL
    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">Ошибка: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">Нет доступа</div>;

    // 3) Данные категорий
    const { data: rpcData, error } = await supa.rpc('categories_with_usage_v2');
    if (error) return <div className="p-4">Ошибка: {error.message}</div>;

    const list: CategoryUsageRow[] = Array.isArray(rpcData) ? (rpcData as CategoryUsageRow[]) : [];

    // Статистика
    const totalCategories = list.length;
    const activeCategories = list.filter(c => c.is_active).length;
    const totalUsage = list.reduce((sum, c) => sum + c.usage_count, 0);
    const mostUsed = list.length > 0 ? list.reduce((max, c) => c.usage_count > max.usage_count ? c : max, list[0]) : null;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Категории бизнеса
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Управление категориями для бизнесов
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link href="/admin">
                                <Button variant="outline" className="w-full sm:w-auto">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    В админку
                                </Button>
                            </Link>
                            <Link href="/admin/categories/new">
                                <Button className="w-full sm:w-auto">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Новая категория
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Статистика */}
                <section className="grid gap-4 sm:grid-cols-3">
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Всего категорий</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCategories}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Активных</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeCategories}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Использований</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalUsage}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Таблица категорий */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
                    {list.length > 0 ? (
                        <>
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Список категорий
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Название
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Slug
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Статус
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Используется
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Действия
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                        {list.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                            </svg>
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            {c.name_ru}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded inline-block">
                                                        {c.slug}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <StatusBadge isActive={c.is_active} />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            {c.usage_count}
                                                        </span>
                                                        {c.usage_count > 0 && (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                бизнес{c.usage_count === 1 ? '' : c.usage_count < 5 ? 'а' : 'ов'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <Link
                                                            href={`/admin/categories/${c.id}`}
                                                            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                            Редактировать
                                                        </Link>
                                                        <DeleteCategoryButton id={c.id} slug={c.slug} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {mostUsed && mostUsed.usage_count > 0 && (
                                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span>
                                            Самая популярная: <strong className="text-gray-900 dark:text-gray-100">{mostUsed.name_ru}</strong> ({mostUsed.usage_count} {mostUsed.usage_count === 1 ? 'бизнес' : 'бизнесов'})
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                                    <svg className="w-12 h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        Категорий пока нет
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Создайте первую категорию для организации бизнесов
                                    </p>
                                    <Link href="/admin/categories/new">
                                        <Button>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Создать первую категорию
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isActive ? 'Активна' : 'Выключена'}
        </span>
    );
}
