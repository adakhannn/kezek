import Link from 'next/link';

import { RoleApplicationsClient } from './RoleApplicationsClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function DashboardRoleApplicationsPage() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
                        Команда
                    </p>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        Заявки сотрудников
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                        Здесь владелец проверяет заявки на работу в бизнесе. При принятии выберите
                        филиал — роль, рабочая карточка и базовое расписание будут созданы вместе.
                    </p>
                </div>
                <Link
                    href="/business/staff-apply"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                    Открыть форму сотрудника
                </Link>
            </div>

            <RoleApplicationsClient />
        </main>
    );
}
