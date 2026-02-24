import { notFound } from 'next/navigation';

import Client from './Client';
import StaffSchedulePageClient from './StaffSchedulePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string; is_active: boolean };

export default async function StaffSchedulePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // сотрудник
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', id)
        .maybeSingle();

    if (eStaff) {
        return (
            <main className="p-6 text-red-600">
                Ошибка: {eStaff.message}
            </main>
        );
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) return notFound();

    // данные бизнеса для контекста
    const { data: biz } = await supabase
        .from('businesses')
        .select('name, city')
        .eq('id', bizId)
        .maybeSingle<{ name: string | null; city: string | null }>();

    const bizName = biz?.name ?? null;
    const bizCity = biz?.city ?? null;

    // филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) {
        return (
            <main className="p-6 text-red-600">
                Ошибка филиалов: {eBranches.message}
            </main>
        );
    }

    const activeBranches: Branch[] = (branches ?? []).filter((b) => b.is_active);

    return (
        <main className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <StaffSchedulePageClient
                staffId={String(staff.id)}
                staffName={staff.full_name || ''}
                bizName={bizName}
                bizCity={bizCity}
            />

            <Client
                bizId={String(bizId)}
                staffId={String(staff.id)}
                branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
                homeBranchId={String(staff.branch_id)}
            />
        </main>
    );
}
