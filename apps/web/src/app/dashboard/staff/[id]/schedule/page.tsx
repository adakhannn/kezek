import { notFound } from 'next/navigation';

import Client from './Client'; // см. пункт 2

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string; is_active: boolean };

export default async function StaffSchedulePage(context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};

    const staffId = String(params.id ?? '');
    const { supabase, bizId } = await getBizContextForManagers();

    // сотрудник
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', staffId)
        .maybeSingle();

    if (eStaff) {
        return <main className="p-6 text-red-600">Ошибка: {eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) return notFound();

    // филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) {
        return <main className="p-6 text-red-600">Ошибка филиалов: {eBranches.message}</main>;
    }

    const activeBranches: Branch[] = (branches ?? []).filter((b) => b.is_active);

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">
                Расписание — {staff.full_name}
            </h1>

            <Client
                bizId={String(bizId)}
                staffId={String(staff.id)}
                branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
                homeBranchId={String(staff.branch_id)}  // ← ВАЖНО: родной филиал
            />
        </main>
    );
}
