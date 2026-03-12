'use client';

/**
 * Показывается пока грузится страница финансов сотрудника (getBizContext + проверка staff).
 * Даёт мгновенный отклик при переходе на /dashboard/staff/[id]/finance.
 */
export default function StaffFinanceLoading() {
    return (
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 min-w-0 animate-pulse">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-8 w-72 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-96 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-4 sm:p-6 space-y-6">
                    <div className="flex gap-2">
                        <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
                        <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
                        <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    </div>
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                </div>
            </div>
        </div>
    );
}
