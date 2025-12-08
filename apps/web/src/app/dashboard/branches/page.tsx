// apps/web/src/app/dashboard/branches/page.tsx  (или ваш путь)
import Link from 'next/link';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
};

export default async function BranchesListPage() {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: branches, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (error) {
        return <main className="p-6 text-red-600">Ошибка: {error.message}</main>;
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Филиалы</h1>
                    <p className="text-gray-600 dark:text-gray-400">Управление филиалами бизнеса</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Название</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Адрес</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Статус</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-40">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(branches ?? []).map((b: Branch) => (
                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{b.address ?? '—'}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        b.is_active
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                        {b.is_active ? 'активен' : 'скрыт'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <Link href={`/dashboard/branches/${b.id}`} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                                        Редакт.
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {(branches ?? []).length === 0 && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                                    Пока нет филиалов
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
