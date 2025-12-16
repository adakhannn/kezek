import Link from 'next/link';
import {notFound} from 'next/navigation';

import StaffForm from '../StaffForm';

import DangerActions from "@/app/dashboard/staff/[id]/DangerActions";
import StaffServicesEditor from "@/app/dashboard/staff/[id]/StaffServicesEditor";
import TransferStaffDialog from "@/app/dashboard/staff/[id]/TransferStaffDialog";
import {getBizContextForManagers} from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const {supabase, bizId} = await getBizContextForManagers();

    // Грузим сотрудника и список филиалов текущего бизнеса
    const [{data: staff, error: eStaff}, {data: branches, error: eBr}] = await Promise.all([
        supabase
            .from('staff')
            .select('id,full_name,email,phone,branch_id,is_active,biz_id,percent_master,percent_salon')
            .eq('id', id)
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
    const currentBranch = (branches ?? []).find(b => b.id === staff.branch_id);

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Редактирование сотрудника</h1>
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-gray-600 dark:text-gray-400">Управление данными сотрудника</p>
                            {currentBranch && (
                                <>
                                    <span className="text-gray-400 dark:text-gray-500">•</span>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Филиал: <span className="text-indigo-600 dark:text-indigo-400">{currentBranch.name}</span>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Link className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href={`/dashboard/staff/${staff.id}/schedule`}>
                            Расписание
                        </Link>
                        <Link className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href={`/dashboard/staff/${staff.id}/slots`}>
                            Свободные слоты
                        </Link>
                        {activeBranches.length > 1 && (
                            <TransferStaffDialog
                                staffId={String(staff.id)}
                                currentBranchId={String(staff.branch_id)}
                                branches={activeBranches.map(b => ({id: String(b.id), name: String(b.name)}))}
                            />
                        )}
                    </div>
                </div>
            </div>

            {activeBranches.length === 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-md">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium mb-1">В этом бизнесе ещё нет активных филиалов</p>
                            <p className="text-gray-600 dark:text-gray-400">Создайте хотя бы один филиал, чтобы назначить сотрудника.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <StaffForm
                    initial={{
                        id: String(staff.id),
                        full_name: String(staff.full_name),
                        email: (staff.email ?? null),
                        phone: (staff.phone ?? null),
                        branch_id: String(staff.branch_id),
                        is_active: Boolean(staff.is_active),
                        percent_master: Number(staff.percent_master ?? 60),
                        percent_salon: Number(staff.percent_salon ?? 40),
                    }}
                    apiBase="/api/staff"
                />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <StaffServicesEditor
                    staffId={String(staff.id)}
                    staffBranchId={String(staff.branch_id)}
                />
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    Временные переводы между филиалами задаются в разделе{' '}
                    <Link href={`/dashboard/staff/${staff.id}/schedule`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        «Расписание»
                    </Link>.
                </p>
            </div>

            <DangerActions staffId={String(staff.id)}/>
        </div>
    );
}
