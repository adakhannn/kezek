import Link from 'next/link';

type DashboardQuickActionsSectionProps = {
    t: (key: string, fallback?: string) => string;
};

export function DashboardQuickActionsSection({ t }: DashboardQuickActionsSectionProps) {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{t('dashboard.quickActions.title', 'Быстрые действия')}</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('dashboard.quickActions.subtitle', 'Частые операции, которые экономят время владельцу.')}
                    </p>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4 lg:gap-3">
                    <Link href="/dashboard/bookings" className="flex flex-col rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs font-medium text-indigo-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
                        <span>{t('dashboard.quickActions.openCalendar', 'Открыть «Календарь»')}</span>
                        <span className="mt-0.5 text-[11px] font-normal text-indigo-700/80 dark:text-indigo-200/90">
                            {t('dashboard.quickActions.openCalendarHint', 'посмотреть ближайшие записи')}
                        </span>
                    </Link>
                    <Link href="/dashboard/staff/new" className="flex flex-col rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                        <span>{t('dashboard.quickActions.addStaff', 'Добавить сотрудника')}</span>
                        <span className="mt-0.5 text-[11px] font-normal text-emerald-700/80 dark:text-emerald-200/90">
                            {t('dashboard.quickActions.addStaffHint', 'добавить сотрудника в систему')}
                        </span>
                    </Link>
                    <Link href="/dashboard/services/new" className="flex flex-col rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
                        <span>{t('dashboard.quickActions.addService', 'Добавить услугу')}</span>
                        <span className="mt-0.5 text-[11px] font-normal text-sky-700/80 dark:text-sky-200/90">
                            {t('dashboard.quickActions.addServiceHint', 'указать цену и длительность')}
                        </span>
                    </Link>
                    <Link href="/dashboard/staff" className="flex flex-col rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-2 text-xs font-medium text-purple-800 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-100">
                        <span>{t('dashboard.quickActions.assignServices', 'Назначить услуги сотруднику')}</span>
                        <span className="mt-0.5 text-[11px] font-normal text-purple-700/80 dark:text-purple-200/90">
                            {t('dashboard.quickActions.assignServicesHint', 'распределить услуги по сотрудникам')}
                        </span>
                    </Link>
                </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">
                {t('dashboard.quickActions.navigationHint', 'Навигация слева доступна на всех страницах кабинета — вы всегда можете быстро вернуться к нужному разделу.')}
            </p>
        </section>
    );
}
