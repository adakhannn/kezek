import type {
    DashboardHomeClientProps,
    DashboardHomeFocus,
    DashboardMetricCard,
    DashboardQuickAction,
    DashboardRatingFactor,
} from './types';

const localeMap: Record<string, string> = {
    ky: 'ky-KG',
    ru: 'ru-RU',
    en: 'en-US',
};

type Translate = (key: string, fallback: string) => string;

export function getDashboardHomeViewModel(
    props: DashboardHomeClientProps,
    locale: string,
    t: Translate,
) {
    const today = new Date(props.formattedDate);
    const formatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    const displayBizName = props.bizName || t('dashboard.header.defaultBizName', 'Ваш бизнес в Kezek');
    const formattedDateLocalized = formatter.format(today);

    const onboardingItems = [
        props.branchesCount === 0
            ? t('dashboard.onboarding.noBranches', 'Создай хотя бы один филиал, чтобы клиенты могли записываться.')
            : null,
        props.servicesActive === 0
            ? t('dashboard.onboarding.noServices', 'Добавь услуги и укажи продолжительность и цену.')
            : null,
        props.staffActive === 0
            ? t('dashboard.onboarding.noStaff', 'Добавь сотрудников и укажи, кто оказывает какие услуги.')
            : null,
        props.bookingsToday === 0
            ? t(
                  'dashboard.onboarding.noBookings',
                  'Проверь «Календарь» — первые брони появятся здесь автоматически.',
              )
            : null,
    ].filter((item): item is string => Boolean(item));

    const pending = props.staffApplications?.pending;
    const primaryFocus: DashboardHomeFocus = pending != null && pending > 0
        ? {
              title: `${t('dashboard.applications.title', 'Заявки сотрудников')} · ${pending}`,
              description: t('dashboard.applications.pending', 'Ожидают вашего решения. Рассмотрите заявки и выберите филиал для новых сотрудников.'),
              ctaLabel: t('dashboard.applications.review', 'Рассмотреть заявки'),
              href: '/dashboard/role-applications',
              tone: 'info',
          }
        : props.needOnboarding
        ? {
              title: t('dashboard.commandCenter.focus.setupTitle', 'Сначала доведите кабинет до рабочего состояния'),
              description:
                  onboardingItems[0] ??
                  t(
                      'dashboard.commandCenter.focus.setupDesc',
                      'Добавьте базовые сущности и проверьте настройки, чтобы команда и клиенты могли работать без блокеров.',
                  ),
              ctaLabel: t('dashboard.commandCenter.focus.setupCta', 'Завершить настройку'),
              href:
                  props.branchesCount === 0
                      ? '/dashboard/branches'
                      : props.servicesActive === 0
                        ? '/dashboard/services'
                        : props.staffActive === 0
                          ? '/dashboard/staff'
                          : '/dashboard/bookings',
              tone: 'warning',
          }
        : props.bookingsToday > 0
          ? {
                title: t('dashboard.commandCenter.focus.todayTitle', 'Сегодня кабинет уже в рабочем режиме'),
                description: t(
                    'dashboard.commandCenter.focus.todayDesc',
                    'Проверьте календарь, загрузку команды и будьте готовы к ближайшим клиентам.',
                ),
                ctaLabel: t('dashboard.commandCenter.focus.todayCta', 'Открыть календарь'),
                href: '/dashboard/bookings',
                tone: 'info',
            }
          : {
                title: t('dashboard.commandCenter.focus.growthTitle', 'Сегодня можно заняться ростом кабинета'),
                description: t(
                    'dashboard.commandCenter.focus.growthDesc',
                    'Записей на сегодня нет, поэтому это хорошее время обновить услуги, график и доступность команды.',
                ),
                ctaLabel: t('dashboard.commandCenter.focus.growthCta', 'Проверить услуги'),
                href: '/dashboard/services',
                tone: 'success',
            };

    const metricCards: DashboardMetricCard[] = [
        {
            key: 'bookingsToday',
            value: props.bookingsToday,
            title: t('dashboard.kpi.bookingsToday', 'Брони сегодня'),
            hint: t('dashboard.stats.bookingsTodayHint', 'в календаре записи'),
            href: '/dashboard/bookings',
            actionLabel: t('dashboard.kpi.openCalendar', 'Открыть календарь'),
            borderClassName: 'border-indigo-100 hover:border-indigo-200 dark:border-indigo-900/40',
            iconWrapperClassName: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40',
            linkClassName: 'text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300',
            icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
            ),
        },
        {
            key: 'activeStaff',
            value: props.staffActive,
            title: t('dashboard.kpi.activeStaff', 'Активные сотрудники'),
            hint: t('dashboard.stats.activeStaffHint', 'готовы принимать клиентов'),
            href: '/dashboard/staff',
            actionLabel: t('dashboard.kpi.manageStaff', 'Управлять сотрудниками'),
            borderClassName: 'border-emerald-100 hover:border-emerald-200 dark:border-emerald-900/40',
            iconWrapperClassName: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40',
            linkClassName: 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300',
            icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                </svg>
            ),
        },
        {
            key: 'activeServices',
            value: props.servicesActive,
            title: t('dashboard.kpi.activeServices', 'Активные услуги'),
            hint: t('dashboard.kpi.activeServicesHint', 'доступны для записи'),
            href: '/dashboard/services',
            actionLabel: t('dashboard.kpi.goToServices', 'Перейти к услугам'),
            borderClassName: 'border-sky-100 hover:border-sky-200 dark:border-sky-900/40',
            iconWrapperClassName: 'bg-sky-50 text-sky-500 dark:bg-sky-950/40',
            linkClassName: 'text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300',
            icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                </svg>
            ),
        },
        {
            key: 'branches',
            value: props.branchesCount,
            title: t('dashboard.kpi.branches', 'Филиалы'),
            hint: t('dashboard.kpi.branchesHint', 'рабочие точки бизнеса'),
            href: '/dashboard/branches',
            actionLabel: t('dashboard.kpi.branchesList', 'Список филиалов'),
            borderClassName: 'border-purple-100 hover:border-purple-200 dark:border-purple-900/40',
            iconWrapperClassName: 'bg-purple-50 text-purple-500 dark:bg-purple-950/40',
            linkClassName: 'text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300',
            icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                </svg>
            ),
        },
    ];

    const quickActions: DashboardQuickAction[] = [
        {
            key: 'openCalendar',
            href: '/dashboard/bookings',
            title: t('dashboard.quickActions.openCalendar', 'Открыть календарь'),
            hint: t('dashboard.quickActions.openCalendarHint', 'посмотреть ближайшие записи'),
            emphasis: t('dashboard.quickActions.openCalendarEmphasis', 'Контроль дня'),
            className:
                'border-indigo-500/25 bg-indigo-500/[0.07] text-[var(--text-primary)] hover:border-indigo-400/55 hover:bg-indigo-500/[0.12]',
            hintClassName: 'text-[var(--text-muted)]',
        },
        {
            key: 'addStaff',
            href: '/dashboard/staff/new',
            title: t('dashboard.quickActions.addStaff', 'Добавить сотрудника'),
            hint: t('dashboard.quickActions.addStaffHint', 'усилить команду или открыть новую смену'),
            emphasis: t('dashboard.quickActions.addStaffEmphasis', 'Рост команды'),
            className:
                'border-emerald-500/25 bg-emerald-500/[0.07] text-[var(--text-primary)] hover:border-emerald-400/55 hover:bg-emerald-500/[0.12]',
            hintClassName: 'text-[var(--text-muted)]',
        },
        {
            key: 'addService',
            href: '/dashboard/services/new',
            title: t('dashboard.quickActions.addService', 'Добавить услугу'),
            hint: t('dashboard.quickActions.addServiceHint', 'обновить каталог, цену и длительность'),
            emphasis: t('dashboard.quickActions.addServiceEmphasis', 'Каталог услуг'),
            className:
                'border-sky-500/25 bg-sky-500/[0.07] text-[var(--text-primary)] hover:border-sky-400/55 hover:bg-sky-500/[0.12]',
            hintClassName: 'text-[var(--text-muted)]',
        },
        {
            key: 'assignServices',
            href: '/dashboard/staff',
            title: t('dashboard.quickActions.assignServices', 'Назначить услуги сотруднику'),
            hint: t('dashboard.quickActions.assignServicesHint', 'проверить связки между командой и услугами'),
            emphasis: t('dashboard.quickActions.assignServicesEmphasis', 'Операционная точность'),
            className:
                'border-purple-500/25 bg-purple-500/[0.07] text-[var(--text-primary)] hover:border-purple-400/55 hover:bg-purple-500/[0.12]',
            hintClassName: 'text-[var(--text-muted)]',
        },
    ];

    const ratingFactors: DashboardRatingFactor[] = props.ratingWeights
        ? [
              {
                  key: 'reviews',
                  label: t('dashboard.rating.factor.reviews', 'Отзывы'),
                  value: props.ratingWeights.reviews,
                  dotClassName: 'bg-emerald-500',
              },
              {
                  key: 'productivity',
                  label: t('dashboard.rating.factor.productivity', 'Количество клиентов'),
                  value: props.ratingWeights.productivity,
                  dotClassName: 'bg-indigo-500',
              },
              {
                  key: 'loyalty',
                  label: t('dashboard.rating.factor.loyalty', 'Возвращаемость клиентов'),
                  value: props.ratingWeights.loyalty,
                  dotClassName: 'bg-sky-500',
              },
              {
                  key: 'discipline',
                  label: t('dashboard.rating.factor.discipline', 'Дисциплина'),
                  value: props.ratingWeights.discipline,
                  dotClassName: 'bg-rose-500',
              },
          ]
        : [];

    return {
        displayBizName,
        formattedDateLocalized,
        onboardingItems,
        primaryFocus,
        metricCards,
        quickActions,
        ratingFactors,
    };
}
