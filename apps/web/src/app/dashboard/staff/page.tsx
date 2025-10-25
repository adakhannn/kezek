import Link from 'next/link';

import ActionButtons from './ActionButtons';

import FlashBanner from "@/app/dashboard/staff/FlashBanner";
import { getBizContextForManagers } from '@/lib/authBiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({
                                       searchParams,
                                   }: {
    searchParams?: { dismissed?: string };
}) {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: rows } = await supabase
        .from('staff')
        .select('id,full_name,is_active,branch_id,branches(name)')
        .eq('biz_id', bizId)
        .order('full_name');

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Сотрудники</h1>
                <Link className="border rounded px-3 py-1" href="/dashboard/staff/new">+ Добавить</Link>
            </div>

            <FlashBanner
                showInitially={searchParams?.dismissed === '1'}
                text="Сотрудник уволен."
            />
            <table className="min-w-full text-sm">
                <thead>
                <tr className="text-left">
                    <th className="p-2">ФИО</th>
                    <th className="p-2">Филиал</th>
                    <th className="p-2">Статус</th>
                    <th className="p-2">Действия</th>
                </tr>
                </thead>
                <tbody>
                {(rows ?? []).map((r) => (
                    <tr key={r.id} className="border-t">
                        <td className="p-2">{r.full_name}</td>
                        <td className="p-2">{r.branches?.[0]?.name ?? r.branch_id}</td>
                        <td className="p-2">{r.is_active ? 'активен' : 'скрыт'}</td>
                        <td className="p-2">
                            <ActionButtons id={String(r.id)} isActive={!!r.is_active} />
                        </td>
                    </tr>
                ))}
                {(!rows || rows.length === 0) && (
                    <tr className="border-t">
                        <td className="p-2 text-gray-500" colSpan={4}>Пока нет сотрудников</td>
                    </tr>
                )}
                </tbody>
            </table>
        </main>
    );
}
