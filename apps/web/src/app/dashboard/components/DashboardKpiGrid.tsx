import Link from 'next/link';

type DashboardKpiGridProps = {
    bookingsToday: number;
    staffActive: number;
    servicesActive: number;
    branchesCount: number;
    t: (key: string, fallback?: string) => string;
};

export function DashboardKpiGrid({
    bookingsToday,
    staffActive,
    servicesActive,
    branchesCount,
    t,
}: DashboardKpiGridProps) {
    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="group rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-indigo-900/40 dark:bg-gray-900/80">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">{t('dashboard.kpi.bookingsToday', 'Брони сегодня')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{bookingsToday}</p>
                    </div>
                    <div className="rounded-full bg-indigo-50 p-2 text-indigo-500 dark:bg-indigo-950/40">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
                <Link href="/dashboard/bookings" className="mt-3 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                    {t('dashboard.kpi.openCalendar', 'Открыть календарь')}
                    <span className="ml-1">→</span>
                </Link>
            </div>

            <div className="group rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-gray-900/80">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">{t('dashboard.kpi.activeStaff', 'Активные сотрудники')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{staffActive}</p>
                    </div>
                    <div className="rounded-full bg-emerald-50 p-2 text-emerald-500 dark:bg-emerald-950/40">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                </div>
                <Link href="/dashboard/staff" className="mt-3 inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                    {t('dashboard.kpi.manageStaff', 'Управлять сотрудниками')}
                    <span className="ml-1">→</span>
                </Link>
            </div>

            <div className="group rounded-2xl border border-sky-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md dark:border-sky-900/40 dark:bg-gray-900/80">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-sky-500">{t('dashboard.kpi.activeServices', 'Активные услуги')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{servicesActive}</p>
                    </div>
                    <div className="rounded-full bg-sky-50 p-2 text-sky-500 dark:bg-sky-950/40">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                </div>
                <Link href="/dashboard/services" className="mt-3 inline-flex items-center text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
                    {t('dashboard.kpi.goToServices', 'Перейти к услугам')}
                    <span className="ml-1">→</span>
                </Link>
            </div>

            <div className="group rounded-2xl border border-purple-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md dark:border-purple-900/40 dark:bg-gray-900/80">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-purple-500">{t('dashboard.kpi.branches', 'Филиалы')}</p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{branchesCount}</p>
                    </div>
                    <div className="rounded-full bg-purple-50 p-2 text-purple-500 dark:bg-purple-950/40">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                </div>
                <Link href="/dashboard/branches" className="mt-3 inline-flex items-center text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
                    {t('dashboard.kpi.branchesList', 'Список филиалов')}
                    <span className="ml-1">→</span>
                </Link>
            </div>
        </section>
    );
}
