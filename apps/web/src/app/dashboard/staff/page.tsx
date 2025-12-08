import Link from 'next/link';

import ActionButtons from './ActionButtons';

import FlashBanner from '@/app/dashboard/staff/FlashBanner';
import { getBizContextForManagers } from '@/lib/authBiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    // join объектом, а не массивом
    branches: { name: string } | null;
};

export default async function Page({
                                       // ВАЖНО: в проекте searchParams это Promise<...>
                                       searchParams,
                                   }: {
    searchParams?: Promise<{ dismissed?: string | string[] }>;
}) {
    const { supabase, bizId } = await getBizContextForManagers();

    // распаковываем и нормализуем dismissed
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    const dismissedParam = Array.isArray(sp.dismissed) ? sp.dismissed[0] : sp.dismissed;
    const showDismissed = dismissedParam === '1';

    const { data: rows, error } = await supabase
        .from('staff')
        .select('id,full_name,is_active,branch_id,branches(name)')
        .eq('biz_id', bizId)
        .order('full_name');

    if (error) {
        return (
            <main className="mx-auto max-w-5xl p-6">
                <div className="text-red-600">Ошибка загрузки: {error.message}</div>
            </main>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Сотрудники</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление сотрудниками бизнеса</p>
                    </div>
                    <Link className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2" href="/dashboard/staff/new">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Добавить сотрудника
                    </Link>
                </div>
            </div>

            <FlashBanner showInitially={showDismissed} text="Сотрудник уволен." />

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">ФИО</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Филиал</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Статус</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(rows as unknown as Row[] | null)?.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{r.full_name}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{r.branches?.name ?? r.branch_id}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        r.is_active
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                        {r.is_active ? 'активен' : 'скрыт'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <ActionButtons id={String(r.id)} isActive={!!r.is_active} />
                                </td>
                            </tr>
                        ))}

                        {(!rows || rows.length === 0) && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                                    Пока нет сотрудников
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
