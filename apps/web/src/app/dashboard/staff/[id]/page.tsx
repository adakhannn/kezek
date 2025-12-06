import Link from 'next/link';
import {notFound} from 'next/navigation';

import StaffForm from '../StaffForm';

import DangerActions from "@/app/dashboard/staff/[id]/DangerActions";
import StaffServicesEditor from "@/app/dashboard/staff/[id]/StaffServicesEditor";
import TransferStaffDialog from "@/app/dashboard/staff/[id]/TransferStaffDialog";
import {getBizContextForManagers} from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    const {supabase, bizId} = await getBizContextForManagers();

    // Грузим сотрудника и список филиалов текущего бизнеса
    const [{data: staff, error: eStaff}, {data: branches, error: eBr}] = await Promise.all([
        supabase
            .from('staff')
            .select('id,full_name,email,phone,branch_id,is_active,biz_id')
            .eq('id', params.id)
            .maybeSingle(),
        supabase
            .from('branches')
            .select('id,name,is_active')
            .eq('biz_id', bizId)
            .order('name'),
    ]);

    if (eStaff) {
        return <main className="p-6 text-red-600">Ошибка загрузки сотрудника: {eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }
    if (eBr) {
        return <main className="p-6 text-red-600">Ошибка загрузки филиалов: {eBr.message}</main>;
    }

    const activeBranches = (branches ?? []).filter(b => b.is_active);

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Редактирование сотрудника</h1>
                <div className="flex items-center gap-3 text-sm">
                    <Link className="underline" href={`/dashboard/staff/${staff.id}/schedule`}>Расписание</Link>
                    <Link className="underline" href={`/dashboard/staff/${staff.id}/slots`}>Свободные слоты</Link>
                    {activeBranches.length > 1 && (
                        <TransferStaffDialog
                            staffId={String(staff.id)}
                            currentBranchId={String(staff.branch_id)}
                            branches={activeBranches.map(b => ({id: String(b.id), name: String(b.name)}))}
                        />
                    )}
                </div>
            </div>

            {activeBranches.length === 0 && (
                <div className="border rounded p-3 text-sm bg-yellow-50 border-yellow-300 text-yellow-900">
                    В этом бизнесе ещё нет активных филиалов. Создайте хотя бы один филиал, чтобы назначить сотрудника.
                </div>
            )}

            <StaffForm
                initial={{
                    id: String(staff.id),
                    full_name: String(staff.full_name),
                    email: (staff.email ?? null),
                    phone: (staff.phone ?? null),
                    branch_id: String(staff.branch_id), // родной филиал обязателен
                    is_active: Boolean(staff.is_active),
                }}
                apiBase="/api/staff"
            />

            <div className="border rounded p-4">
                <StaffServicesEditor
                    staffId={String(staff.id)}
                    staffBranchId={String(staff.branch_id)}
                />
            </div>

            <div className="pt-2 text-xs text-gray-500">
                Временные переводы между филиалами задаются в разделе <Link
                href={`/dashboard/staff/${staff.id}/schedule`} className="underline">«Расписание»</Link>.
            </div>
            <DangerActions staffId={String(staff.id)}/>
        </main>
    );
}
