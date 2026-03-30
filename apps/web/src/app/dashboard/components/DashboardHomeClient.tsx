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
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
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

            {props.needOnboarding ? (
                <DashboardOnboardingNotice
                    title={t('dashboard.onboarding.title', 'Давайте доведём кабинет до рабочего состояния.')}
                    items={viewModel.onboardingItems}
                />
            ) : null}

            <DashboardMetricsGrid cards={viewModel.metricCards} />

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

            <DashboardQuickActionsCard
                actions={viewModel.quickActions}
                title={t('dashboard.quickActions.title', 'Быстрые действия')}
                subtitle={t(
                    'dashboard.quickActions.subtitle',
                    'Частые операции, которые экономят время владельцу.',
                )}
                navigationHint={t(
                    'dashboard.quickActions.navigationHint',
                    'Навигация слева доступна на всех страницах кабинета — вы всегда можете быстро вернуться к нужному разделу.',
                )}
            />
        </main>
    );
}
