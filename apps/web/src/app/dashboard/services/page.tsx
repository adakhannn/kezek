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

    const list = (services ?? []).filter(
        (s) => !branchFilter || s.branch_id === branchFilter,
    );

    return (
        <main className="mx-auto max-w-6xl space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Услуги</h1>
                <Link href="/dashboard/services/new" className="border rounded px-3 py-1">
                    + Добавить
                </Link>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Филиал:</span>
                <Link
                    className={`text-sm px-2 py-1 rounded border ${
                        branchFilter ? 'hover:bg-gray-50' : 'bg-gray-100 font-medium'
                    }`}
                    href="/dashboard/services"
                >
                    Все
                </Link>
                {(branches ?? []).map((b: Branch) => (
                    <Link
                        key={b.id}
                        className={`text-sm px-2 py-1 rounded border ${
                            branchFilter === b.id ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
                        }`}
                        href={`/dashboard/services?branch=${b.id}`}
                    >
                        {b.name}
                    </Link>
                ))}
            </div>

            <div className="border rounded overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                    <tr className="text-left">
                        <th className="p-2">Название</th>
                        <th className="p-2">Длительность</th>
                        <th className="p-2">Цена</th>
                        <th className="p-2">Филиал</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2 w-40">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {list.map((s: ServiceRow) => {
                        const branchName =
                            (branches ?? []).find((b) => b.id === s.branch_id)?.name ?? '—';
                        return (
                            <tr key={s.id} className="border-t">
                                <td className="p-2">{s.name_ru}</td>
                                <td className="p-2">{s.duration_min} мин</td>
                                <td className="p-2">
                                    {s.price_from}–{s.price_to}
                                </td>
                                <td className="p-2">{branchName}</td>
                                <td className="p-2">{s.active ? 'активна' : 'скрыта'}</td>
                                <td className="p-2">
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/services/${s.id}`}
                                            className="border rounded px-2 py-1"
                                        >
                                            Редакт.
                                        </Link>
                                        <DeleteServiceButton id={s.id} />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {list.length === 0 && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={6}>
                                Нет услуг
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
