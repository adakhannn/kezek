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

