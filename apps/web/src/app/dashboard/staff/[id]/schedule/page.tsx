import Link from 'next/link';

import Client from './Client';

import {getBizContextForManagers} from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffSchedulePage(context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    const {supabase, bizId} = await getBizContextForManagers();

    const [{data: staff}, {data: branches}] = await Promise.all([
        supabase.from('staff')
            .select('id, full_name, biz_id, branch_id, is_active')
            .eq('id', params.id)
            .maybeSingle(),
        supabase.from('branches')
            .select('id, name, is_active')
            .eq('biz_id', bizId)
            .order('name'),
    ]);

    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return <main className="p-6 text-red-600">Сотрудник не найден или нет доступа</main>;
    }

    const activeBranches = (branches ?? []).filter(b => b.is_active);

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">График — {staff.full_name}</h1>
                <div className="flex items-center gap-4 text-sm">
                    <Link className="underline" href={`/dashboard/staff/${staff.id}`}>Карточка</Link>
                    <Link className="underline" href={`/dashboard/staff/${staff.id}/slots`}>Свободные слоты</Link>
                </div>
            </div>

            <Client
                bizId={bizId}
                staffId={staff.id}
                defaultBranchId={staff.branch_id}
                branches={activeBranches.map(b => ({id: b.id, name: b.name}))}
            />
        </main>
    );
}
