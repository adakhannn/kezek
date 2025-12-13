import Link from 'next/link';

import DeleteServiceButton from './DeleteServiceButton';

import { getBizContextForManagers } from '@/lib/authBiz';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string };
type ServiceRow = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean | null;
    branch_id: string;
};

export default async function ServicesListPage({
                                                   // ВАЖНО: async searchParams — это Promise<...>
                                                   searchParams,
                                               }: {
    searchParams?: Promise<{ branch?: string | string[] }>;
}) {
    const { supabase, bizId } = await getBizContextForManagers();

    // Распаковываем searchParams
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    // Нормализуем branch к строке
    const branchFilter =
        Array.isArray(sp.branch) ? (sp.branch[0] ?? '') : (sp.branch ?? '');

    const [{ data: branches }, { data: services, error }] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('services')
            .select('id,name_ru,duration_min,price_from,price_to,active,branch_id')
            .eq('biz_id', bizId)
            .order('name_ru'),
    ]);

    if (error) {
        return <main className="p-6 text-red-600">Ошибка: {error.message}</main>;
    }

    // Группируем услуги по названию (убираем дубли)
    type GroupedService = {
        name_ru: string;
        duration_min: number;
        price_from: number;
        price_to: number;
        active: boolean;
        branch_ids: string[];
        first_id: string; // ID первой услуги для редактирования
    };

    const serviceMap = new Map<string, GroupedService>();
    
    (services ?? []).forEach((s: ServiceRow) => {
        // Применяем фильтр по филиалу
        if (branchFilter && s.branch_id !== branchFilter) return;
        
        // Учитываем только активные услуги при группировке
        // Неактивные услуги (мягко удаленные) не должны показываться в списке филиалов
        if (!s.active) return;
        
        const key = s.name_ru;
        if (!serviceMap.has(key)) {
            serviceMap.set(key, {
                name_ru: s.name_ru,
                duration_min: s.duration_min,
                price_from: s.price_from,
                price_to: s.price_to,
                active: s.active ?? false,
                branch_ids: [s.branch_id],
                first_id: s.id,
            });
        } else {
            const existing = serviceMap.get(key)!;
            if (!existing.branch_ids.includes(s.branch_id)) {
                existing.branch_ids.push(s.branch_id);
            }
            // Обновляем статус: активна, если хотя бы в одном филиале активна
            if (s.active) existing.active = true;
        }
    });

    const list = Array.from(serviceMap.values());

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Услуги</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление услугами бизнеса</p>
                    </div>
                    <Link href="/dashboard/services/new" className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Добавить услугу
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Филиал:</span>
                    <Link
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                            branchFilter
                                ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                        }`}
                        href="/dashboard/services"
                    >
                        Все
                    </Link>
                    {(branches ?? []).map((b: Branch) => (
                        <Link
                            key={b.id}
                            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                                branchFilter === b.id
                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            href={`/dashboard/services?branch=${b.id}`}
                        >
                            {b.name}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Название</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Длительность</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Цена</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Филиал</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Статус</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-40">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {list.map((s: GroupedService) => {
                            const branchNames = s.branch_ids
                                .map((bid) => (branches ?? []).find((b) => b.id === bid)?.name)
                                .filter(Boolean)
                                .join(', ');
                            
                            return (
                                <tr key={s.first_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{s.name_ru}</td>
                                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{s.duration_min} мин</td>
                                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                        {s.price_from}–{s.price_to} сом
                                    </td>
                                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                        {branchNames || '—'}
                                        {s.branch_ids.length > 1 && (
                                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                ({s.branch_ids.length} филиалов)
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            s.active
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                            {s.active ? 'активна' : 'скрыта'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/dashboard/services/${s.first_id}`}
                                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                                            >
                                                Редакт.
                                            </Link>
                                            <DeleteServiceButton id={s.first_id} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {list.length === 0 && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                                    Нет услуг
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
