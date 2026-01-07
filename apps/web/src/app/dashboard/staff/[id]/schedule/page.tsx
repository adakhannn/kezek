import Link from 'next/link';
import { notFound } from 'next/navigation';

import Client from './Client'; // см. пункт 2

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
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок */}
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                <div className="px-6 py-6 lg:px-8 lg:py-7">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <Link
                                    href={`/dashboard/staff/${staff.id}`}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    title="Назад к карточке сотрудника"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </Link>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Расписание</h1>
                                    <p className="text-sm lg:text-base text-indigo-100/90 mt-1">{staff.full_name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Client
                bizId={String(bizId)}
                staffId={String(staff.id)}
                branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
                homeBranchId={String(staff.branch_id)}
            />
        </main>
    );
}
