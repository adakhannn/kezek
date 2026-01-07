import Link from 'next/link';
import { notFound } from 'next/navigation';

import StaffFinanceStats from './components/StaffFinanceStats';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinancePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Проверяем, что сотрудник принадлежит этому бизнесу
    const { data: staff, error } = await supabase
        .from('staff')
        .select('id, biz_id, full_name')
        .eq('id', id)
        .maybeSingle();

    if (error || !staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href={`/dashboard/staff/${id}`}
                        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Назад к сотруднику
                    </Link>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Финансы: {staff.full_name}
                    </h1>
                </div>
            </div>

            {/* Статистика */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    Статистика
                </h2>
                <StaffFinanceStats staffId={id} />
            </div>
        </div>
    );
}

