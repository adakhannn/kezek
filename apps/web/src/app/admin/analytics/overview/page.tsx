'use client';

import {
    AdminAnalyticsFiltersSection,
    AdminAnalyticsKpiSection,
    AdminAnalyticsOverviewError,
    AdminAnalyticsOverviewLoading,
    AdminAnalyticsTrendsSection,
} from './AdminAnalyticsOverviewSections';
import { useAdminAnalyticsOverviewData } from './useAdminAnalyticsOverviewData';

export default function AdminAnalyticsOverviewPage() {
    const {
        loading,
        error,
        periodPreset,
        startDate,
        endDate,
        data,
        trendChartData,
        promoShare,
        handlePresetChange,
        retry,
        setStartDateAndCustom,
        setEndDateAndCustom,
    } = useAdminAnalyticsOverviewData();

    if (loading && !data) {
        return <AdminAnalyticsOverviewLoading />;
    }

    if (error) {
        return <AdminAnalyticsOverviewError error={error} onRetry={retry} />;
    }

    if (!data) {
        return null;
    }

    return (
        <div className="space-y-6 py-6">
            <AdminAnalyticsFiltersSection
                periodPreset={periodPreset}
                onPresetChange={handlePresetChange}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDateAndCustom}
                onEndDateChange={setEndDateAndCustom}
            />

            <AdminAnalyticsKpiSection summary={data.summary} promoShare={promoShare} />

            <AdminAnalyticsTrendsSection trendChartData={trendChartData} byDay={data.byDay} />
        </div>
    );
}
