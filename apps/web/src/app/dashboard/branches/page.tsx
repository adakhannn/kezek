import Link from 'next/link';

import DeleteBranchButton from './DeleteBranchButton'; // ← добавили

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
        <main className="mx-auto max-w-5xl space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Филиалы</h1>
                <Link href="/dashboard/branches/new" className="border rounded px-3 py-1">+ Добавить</Link>
            </div>

            <div className="border rounded overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                    <tr className="text-left">
                        <th className="p-2">Название</th>
                        <th className="p-2">Адрес</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2 w-40">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(branches ?? []).map((b: Branch) => (
                        <tr key={b.id} className="border-t">
                            <td className="p-2">{b.name}</td>
                            <td className="p-2">{b.address ?? '—'}</td>
                            <td className="p-2">{b.is_active ? 'активен' : 'скрыт'}</td>
                            <td className="p-2">
                                <div className="flex gap-2">
                                    <Link href={`/dashboard/branches/${b.id}`} className="border rounded px-2 py-1">Редакт.</Link>
                                    <DeleteBranchButton id={b.id} /> {/* ← больше никакого onSubmit на серверной странице */}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {(branches ?? []).length === 0 && (
                        <tr><td className="p-3 text-gray-500" colSpan={4}>Пока нет филиалов</td></tr>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
