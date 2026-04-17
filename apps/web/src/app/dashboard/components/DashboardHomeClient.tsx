'use client';

import { DashboardHomeHero } from './home/DashboardHomeHero';
import { DashboardMetricsGrid } from './home/DashboardMetricsGrid';
import { DashboardOnboardingNotice } from './home/DashboardOnboardingNotice';
import { DashboardQuickActionsCard } from './home/DashboardQuickActionsCard';
import { DashboardRatingCard } from './home/DashboardRatingCard';
import { getDashboardHomeViewModel } from './home/dashboardHomeViewModel';
import { type DashboardHomeClientProps } from './home/types';
import { IntegrationsStatusCard } from './IntegrationsStatusCard';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export function DashboardHomeClient(props: DashboardHomeClientProps) {
    const { t, locale } = useLanguage();
    const viewModel = getDashboardHomeViewModel(props, locale, t);

    return (
        <main className="mx-auto max-w-[var(--container-2xl)] space-y-8 px-4 py-6 lg:px-8 lg:py-8">
            <DashboardHomeHero
                displayBizName={viewModel.displayBizName}
                formattedDateLocalized={viewModel.formattedDateLocalized}
                bizCity={props.bizCity}
                bookingsToday={props.bookingsToday}
                staffActive={props.staffActive}
                bookingsTodayLabel={t('dashboard.stats.bookingsToday', 'Брони сегодня')}
                bookingsTodayHint={t('dashboard.stats.bookingsTodayHint', 'в календаре записи')}
                activeStaffLabel={t('dashboard.stats.activeStaff', 'Активных сотрудников')}
                activeStaffHint={t('dashboard.stats.activeStaffHint', 'готовы принимать клиентов')}
                badgeLabel={t('dashboard.header.badge', 'Кабинет владельца бизнеса')}
            />

            <DashboardQuickActionsCard
                actions={viewModel.quickActions}
                focus={viewModel.primaryFocus}
                title={t('dashboard.quickActions.title', 'Следующие действия')}
                subtitle={t(
                    'dashboard.quickActions.subtitle',
                    'Собрали самые частые операционные шаги в одном месте, чтобы владелец быстрее принимал решения по дню.',
                )}
                navigationHint={t(
                    'dashboard.quickActions.navigationHint',
                    'Используйте левую навигацию для глубоких разделов, а этот блок держите как точку старта на каждый день.',
                )}
                priorityLabel={t('dashboard.commandCenter.priority', 'Главный фокус')}
            />

            <DashboardMetricsGrid cards={viewModel.metricCards} />

            {props.needOnboarding ? (
                <DashboardOnboardingNotice
                    title={t('dashboard.onboarding.title', 'Перед полноценной работой осталось закрыть несколько шагов')}
                    items={viewModel.onboardingItems}
                    summaryLabel={t('dashboard.onboarding.summary', 'Стартовая готовность')}
                />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <DashboardRatingCard
                    ratingWeights={props.ratingWeights}
                    ratingScore={props.ratingScore}
                    ratingConfigScope={props.ratingConfigScope}
                    ratingFactors={viewModel.ratingFactors}
                    title={t('dashboard.rating.title', 'Рейтинг бизнеса в Kezek')}
                    subtitleTemplate={t(
                        'dashboard.rating.subtitle',
                        'Каждый день влияет на итоговый балл за последние {days} дней.',
                    )}
                    bizScopeLabel={t(
                        'dashboard.rating.scope.biz',
                        'Для этого бизнеса действует своя формула рейтинга.',
                    )}
                    globalScopeLabel={t(
                        'dashboard.rating.scope.global',
                        'Сейчас используется глобальная формула рейтинга платформы.',
                    )}
                    scoreLabel={t('dashboard.rating.scoreLabel', 'Текущий балл')}
                    noRatingLabel={t('common.rating.noRating', 'Нет рейтинга')}
                    lowRatingHint={t('common.rating.lowRatingHint', 'низкий рейтинг')}
                    overallHint={t(
                        'dashboard.rating.hint',
                        'Чем выше рейтинг, тем выше позиция бизнеса, филиалов и сотрудников в выдаче.',
                    )}
                    moreInfoLabel={t('dashboard.rating.moreInfo', 'Как считается рейтинг →')}
                />

                <IntegrationsStatusCard />
            </div>
        </main>
    );
}
