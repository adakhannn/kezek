// apps/web/src/app/admin/businesses/[id]/branches/page.tsx
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import Link from 'next/link';

import {DeleteBranchButton} from '@/components/admin/branches/DeleteBranchButton';

export const dynamic = 'force-dynamic';
type RouteParams = { id: string; branchId: string };
export default async function BranchesPage(
    {params}: { params: Promise<RouteParams> }
) {
    const {id} = await params;
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);

    const [{data: biz}, {data: branches}] = await Promise.all([
        admin.from('businesses').select('id,name').eq('id', id).maybeSingle(),
        admin.from('branches')
            .select('id,name,address,is_active,created_at')
            .eq('biz_id', id)
            .order('created_at', {ascending: true}),
    ]);

    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Филиалы бизнеса: {biz.name}</h1>
                <div className="flex gap-3 text-sm">
                    <Link href={`/admin/businesses/${biz.id}`} className="underline">← К бизнесу</Link>
                    <Link href={`/admin/businesses/${biz.id}/branches/new`}
                          className="inline-flex items-center rounded border px-3 py-1.5 hover:bg-gray-50">
                        + Новый филиал
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[680px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2">Название</th>
                        <th className="border-b p-2">Адрес</th>
                        <th className="border-b p-2">Статус</th>
                        <th className="border-b p-2 w-48">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {(branches ?? []).map((b) => (
                        <tr key={b.id} className="align-top">
                            <td className="border-b p-2">{b.name}</td>
                            <td className="border-b p-2">{b.address ?? '—'}</td>
                            <td className="border-b p-2">{b.is_active ? 'Активен' : 'Выключен'}</td>
                            <td className="border-b p-2">
                                <div className="flex items-center gap-3">
                                    <Link
                                        href={`/admin/businesses/${biz.id}/branches/${b.id}`}
                                        className="underline"
                                    >
                                        Редактировать
                                    </Link>
                                    <DeleteBranchButton bizId={biz.id} branchId={b.id} name={b.name}/>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {(!branches || branches.length === 0) && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={4}>Филиалов пока нет.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
