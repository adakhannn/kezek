'use client';

import {
    DashboardAnalyticsError,
    DashboardAnalyticsEmpty,
    DashboardAnalyticsFiltersSection,
    DashboardAnalyticsHeader,
    DashboardAnalyticsKpiSection,
    DashboardAnalyticsLoadSection,
    DashboardAnalyticsLoading,
    DashboardAnalyticsTrendsSection,
} from './DashboardAnalyticsSections';
import { useDashboardAnalyticsPageData } from './useDashboardAnalyticsPageData';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function DashboardAnalyticsOverviewPage() {
    const { t } = useLanguage();
    const {
        loading,
        error,
        rangeError,
        periodPreset,
        startDate,
        endDate,
        branchId,
        branches,
        data,
        loadData,
        trendChartData,
        promoShare,
        setBranchId,
        handlePresetChange,
        retry,
        setStartDateAndCustom,
        setEndDateAndCustom,
    } = useDashboardAnalyticsPageData();

    if (loading && !data) {
        return <DashboardAnalyticsLoading />;
    }

    return (
        <div className="space-y-6 py-6 px-4 sm:px-6 lg:px-8">
            <DashboardAnalyticsHeader />

            <DashboardAnalyticsFiltersSection
                periodPreset={periodPreset}
                onPresetChange={handlePresetChange}
                startDate={startDate}
                endDate={endDate}
                branchId={branchId}
                branches={branches}
                onStartDateChange={setStartDateAndCustom}
                onEndDateChange={setEndDateAndCustom}
                onBranchIdChange={setBranchId}
            />

            {error || rangeError ? (
                <DashboardAnalyticsError error={rangeError ? t(rangeError) : t('analytics.loadError')} onRetry={retry} />
            ) : loading ? <DashboardAnalyticsLoading /> : data ? <>
            {data.byDay.length === 0 ? <DashboardAnalyticsEmpty /> : <>
            <DashboardAnalyticsKpiSection summary={data.summary} />

            <DashboardAnalyticsTrendsSection
                byDay={data.byDay}
                summary={data.summary}
                promoShare={promoShare}
                trendChartData={trendChartData}
            />
            </>}

            <DashboardAnalyticsLoadSection loadData={loadData ?? undefined} />
            </> : null}
        </div>
    );
}
