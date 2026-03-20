'use client';

import { DashboardHeroSection } from './DashboardHeroSection';
import { DashboardKpiGrid } from './DashboardKpiGrid';
import { DashboardOnboardingSection } from './DashboardOnboardingSection';
import { DashboardQuickActionsSection } from './DashboardQuickActionsSection';
import { DashboardRatingSection } from './DashboardRatingSection';
import { IntegrationsStatusCard } from './IntegrationsStatusCard';
import { formatDashboardHomeDate, getDashboardBizName } from './dashboardHomeHelpers';
import type { DashboardHomeClientProps } from './dashboardHomeTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

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

    const formattedDateLocalized = formatDashboardHomeDate(formattedDate, locale);
    const displayBizName = getDashboardBizName(
        bizName,
        t('dashboard.header.defaultBizName', 'Ваш бизнес в Kezek'),
    );

    return (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
            <DashboardHeroSection
                displayBizName={displayBizName}
                bizCity={bizCity}
                formattedDateLocalized={formattedDateLocalized}
                bookingsToday={bookingsToday}
                staffActive={staffActive}
                t={t}
            />

            {needOnboarding && (
                <DashboardOnboardingSection
                    branchesCount={branchesCount}
                    servicesActive={servicesActive}
                    staffActive={staffActive}
                    bookingsToday={bookingsToday}
                    t={t}
                />
            )}

            <DashboardKpiGrid
                bookingsToday={bookingsToday}
                staffActive={staffActive}
                servicesActive={servicesActive}
                branchesCount={branchesCount}
                t={t}
            />

            {ratingWeights && (
                <DashboardRatingSection
                    ratingScore={ratingScore}
                    ratingWeights={ratingWeights}
                    t={t}
                />
            )}

            <IntegrationsStatusCard />
            <DashboardQuickActionsSection t={t} />
        </main>
    );
}
