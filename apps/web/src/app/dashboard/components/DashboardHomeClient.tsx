'use client';

import Link from 'next/link';

import { IntegrationsStatusCard } from './IntegrationsStatusCard';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type DashboardHomeClientProps = {
    bizName: string | null;
    bizCity: string | null;
    formattedDate: string;
    bookingsToday: number;
    staffActive: number;
    servicesActive: number;
    branchesCount: number;
    needOnboarding: boolean;
    ratingScore: number | null;
    ratingWeights: {
        reviews: number;
        productivity: number;
        loyalty: number;
        discipline: number;
        windowDays: number;
    } | null;
};

const localeMap: Record<string, string> = {
    ky: 'ky-KG',
    ru: 'ru-RU',
    en: 'en-US',
};

export function DashboardHomeClient({
    bizName,
    bizCity,
    formattedDate,
    bookingsToday,
    staffActive,
    servicesActive,
    branchesCount,
    needOnboarding,
    ratingScore,
    ratingWeights,
}: DashboardHomeClientProps) {
    const { t, locale } = useLanguage();
    
    // Форматируем дату с учетом текущей локали
    const today = new Date(formattedDate);
    const formatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    const formattedDateLocalized = formatter.format(today);
    
    // Используем переведенное дефолтное значение, если имя бизнеса не задано
    const displayBizName = bizName || t('dashboard.header.defaultBizName', 'Ваш бизнес в Kezek');

    return (
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8 space-y-8">
            {/* Верхняя панель с названием бизнеса */}
            <section className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                <div className="px-6 py-6 lg:px-8 lg:py-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            {t('dashboard.header.badge', 'Кабинет владельца бизнеса')}
                        </div>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">{displayBizName}</h1>
                            <p className="mt-1 text-sm lg:text-base text-indigo-100/90">
                                {formattedDateLocalized.charAt(0).toUpperCase() + formattedDateLocalized.slice(1)}
                                {bizCity ? ` · ${bizCity}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs lg:text-sm">
                        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                                {bookingsToday}
                            </span>
                            <div className="leading-tight">
                                <div className="font-medium">{t('dashboard.stats.bookingsToday', 'Брони сегодня')}</div>
                                <div className="text-indigo-100/80">{t('dashboard.stats.bookingsTodayHint', 'в календаре записи')}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                                {staffActive}
                            </span>
                            <div className="leading-tight">
                                <div className="font-medium">{t('dashboard.stats.activeStaff', 'Активных сотрудников')}</div>
                                <div className="text-indigo-100/80">{t('dashboard.stats.activeStaffHint', 'готовы принимать клиентов')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Подсказка по настройке, если бизнес только создаётся */}
            {needOnboarding && (
                <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <div className="flex gap-3">
                        <div className="mt-0.5">
                            <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v3m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                                />
                            </svg>
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium">{t('dashboard.onboarding.title', 'Давайте доведём кабинет до рабочего состояния.')}</p>
                            <ul className="list-disc list-inside text-xs space-y-0.5">
                                {branchesCount === 0 && <li>{t('dashboard.onboarding.noBranches', 'Создайте хотя бы один филиал, чтобы клиенты могли записываться.')}</li>}
                                {servicesActive === 0 && <li>{t('dashboard.onboarding.noServices', 'Добавьте услуги и укажите продолжительность и цену.')}</li>}
                                {staffActive === 0 && <li>{t('dashboard.onboarding.noStaff', 'Добавьте сотрудников и укажите, кто оказывает какие услуги.')}</li>}
                                {bookingsToday === 0 && (
                                    <li>{t('dashboard.onboarding.noBookings', 'Проверьте «Календарь» — первые бронирования появятся здесь автоматически.')}</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            {/* KPI блоки */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="group rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-indigo-900/40 dark:bg-gray-900/80">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">{t('dashboard.kpi.bookingsToday', 'Брони сегодня')}</p>
                            <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{bookingsToday}</p>
                        </div>
                        <div className="rounded-full bg-indigo-50 p-2 text-indigo-500 dark:bg-indigo-950/40">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/bookings"
                        className="mt-3 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
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
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/staff"
                        className="mt-3 inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
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
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                            </svg>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/services"
                        className="mt-3 inline-flex items-center text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                    >
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
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                            </svg>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/branches"
                        className="mt-3 inline-flex items-center text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                        {t('dashboard.kpi.branchesList', 'Список филиалов')}
                        <span className="ml-1">→</span>
                    </Link>
                </div>
            </section>

            {/* Рейтинг бизнеса и объяснение факторов */}
            {ratingWeights && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                                    {t('dashboard.rating.title', 'Рейтинг бизнеса в Kezek')}
                                </p>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/90">
                                    {t(
                                        'dashboard.rating.subtitle',
                                        'Каждый день влияет на итоговый балл за последние {days} дней.',
                                    ).replace('{days}', String(ratingWeights.windowDays))}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900/90 dark:text-amber-100">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {t('dashboard.rating.factor.reviews', 'Отзывы')}: {ratingWeights.reviews}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        {t('dashboard.rating.factor.productivity', 'Количество клиентов')}: {ratingWeights.productivity}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                        {t('dashboard.rating.factor.loyalty', 'Возвращаемость клиентов')}: {ratingWeights.loyalty}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                        {t('dashboard.rating.factor.discipline', 'Дисциплина (опоздания)')}: {ratingWeights.discipline}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:flex-col sm:items-end sm:justify-center">
                            {ratingScore !== null && ratingScore !== undefined ? (
                                <div className="inline-flex flex-col items-end gap-0.5">
                                    <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/80 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/50 dark:text-amber-50">
                                        <span className="text-xs font-medium uppercase tracking-wide">
                                            {t('dashboard.rating.scoreLabel', 'Текущий балл')}
                                        </span>
                                        <span className="text-xl font-semibold">{ratingScore.toFixed(1)}</span>
                                        <span className="text-[10px] opacity-70">/ 100</span>
                                    </div>
                                    {ratingScore <= 10 && (
                                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                                            {t('common.rating.lowRatingHint', 'низкий рейтинг')}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/60 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-50">
                                    <span className="text-xs font-medium uppercase tracking-wide">
                                        {t('common.rating.noRating', 'Нет рейтинга')}
                                    </span>
                                </div>
                            )}
                            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 max-w-[180px]">
                                {t(
                                    'dashboard.rating.hint',
                                    'Чем выше рейтинг, тем выше позиция бизнеса, филиалов и сотрудников в выдаче.',
                                )}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* Статус интеграций */}
            <IntegrationsStatusCard />

            {/* Быстрые действия */}
            <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{t('dashboard.quickActions.title', 'Быстрые действия')}</h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('dashboard.quickActions.subtitle', 'Частые операции, которые экономят время владельцу.')}
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3 w-full lg:w-auto">
                        <Link
                            href="/dashboard/bookings"
                            className="flex flex-col rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs font-medium text-indigo-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100"
                        >
                            <span>{t('dashboard.quickActions.openCalendar', 'Открыть «Календарь»')}</span>
                            <span className="mt-0.5 text-[11px] font-normal text-indigo-700/80 dark:text-indigo-200/90">
                                {t('dashboard.quickActions.openCalendarHint', 'посмотреть ближайшие записи')}
                            </span>
                        </Link>
                        <Link
                            href="/dashboard/staff/new"
                            className="flex flex-col rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                        >
                            <span>{t('dashboard.quickActions.addStaff', 'Добавить сотрудника')}</span>
                            <span className="mt-0.5 text-[11px] font-normal text-emerald-700/80 dark:text-emerald-200/90">
                                {t('dashboard.quickActions.addStaffHint', 'добавить сотрудника в систему')}
                            </span>
                        </Link>
                        <Link
                            href="/dashboard/services/new"
                            className="flex flex-col rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100"
                        >
                            <span>{t('dashboard.quickActions.addService', 'Добавить услугу')}</span>
                            <span className="mt-0.5 text-[11px] font-normal text-sky-700/80 dark:text-sky-200/90">
                                {t('dashboard.quickActions.addServiceHint', 'указать цену и длительность')}
                            </span>
                        </Link>
                        <Link
                            href="/dashboard/staff"
                            className="flex flex-col rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-2 text-xs font-medium text-purple-800 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-100"
                        >
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
        </main>
    );
}

