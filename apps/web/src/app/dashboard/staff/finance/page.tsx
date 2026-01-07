import Link from 'next/link';

import AllStaffFinanceStats from './components/AllStaffFinanceStats';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AllStaffFinancePage() {
    await getBizContextForManagers();

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/staff"
                        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Назад к сотрудникам
                    </Link>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Финансовая статистика сотрудников
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Обзор финансовых показателей всех сотрудников
                    </p>
                </div>
            </div>

            {/* Статистика */}
            <AllStaffFinanceStats />
        </div>
    );
}

