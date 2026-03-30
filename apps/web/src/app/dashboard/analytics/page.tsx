'use client';

import {
    DashboardAnalyticsError,
    DashboardAnalyticsFiltersSection,
    DashboardAnalyticsHeader,
    DashboardAnalyticsKpiSection,
    DashboardAnalyticsLoadSection,
    DashboardAnalyticsLoading,
    DashboardAnalyticsTrendsSection,
} from './DashboardAnalyticsSections';
import { useDashboardAnalyticsPageData } from './useDashboardAnalyticsPageData';

export default function DashboardAnalyticsOverviewPage() {
    const {
        loading,
        error,
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

    if (error) {
        return <DashboardAnalyticsError error={error} onRetry={retry} />;
    }

    if (!data) {
        return null;
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

            <DashboardAnalyticsKpiSection summary={data.summary} />

            <DashboardAnalyticsTrendsSection
                byDay={data.byDay}
                summary={data.summary}
                promoShare={promoShare}
                trendChartData={trendChartData}
            />

            <DashboardAnalyticsLoadSection loadData={loadData ?? undefined} />
        </div>
    );
}
