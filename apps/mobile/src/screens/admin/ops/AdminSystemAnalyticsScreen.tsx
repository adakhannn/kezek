import { useState } from 'react';
import { View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { space } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { formatMoneyRounded, formatNumber } from '../../manage/opsKit/money';
import { BarList, CHART_COLOR } from '../../manage/opsKit/ui';
import { fetchSystemOverview } from './adminOpsApi';
import { AdminError, PeriodFilter, usePeriod } from './adminOpsUi';

function chartDay(date: string): string {
    return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** The website's /admin/analytics/system: platform-wide businesses, bookings and revenue of a period, and the days. */
export default function AdminSystemAnalyticsScreen() {
    const { t } = useLanguage();
    const period = usePeriod();
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['admin-ops', 'system-analytics', period.startDate, period.endDate],
        queryFn: () => fetchSystemOverview({ startDate: period.startDate, endDate: period.endDate }),
        enabled: !period.invalid,
        placeholderData: keepPreviousData,
    });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const data = query.data;
    const maxBookings = data ? Math.max(0, ...data.byDay.map((day) => day.bookingsConfirmed)) : 0;
    const maxRevenue = data ? Math.max(0, ...data.byDay.map((day) => day.totalRevenue)) : 0;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-system-analytics-screen">
            <ScreenIntro>{t('adminOps.system.intro')}</ScreenIntro>
            <PeriodFilter period={period} testID="admin-system-period" />

            {period.invalid ? null : query.isLoading ? (
                <View style={{ gap: space.md }}>
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={5} />
                </View>
            ) : query.error && !data ? (
                <AdminError title={t('adminOps.system.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : data ? (
                <View style={{ gap: space.xxl, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    <StatGrid>
                        <StatTile icon="business-outline" label={t('adminOps.system.activeBusinesses')} value={formatNumber(data.summary.activeBusinesses, t.locale)} tone="accent" />
                        <StatTile
                            icon="checkmark-circle-outline"
                            label={t('adminOps.analytics.successfulBookings')}
                            value={formatNumber(data.summary.bookings.confirmed, t.locale)}
                            hint={t('adminOps.system.created', { count: formatNumber(data.summary.bookings.created, t.locale) })}
                        />
                        <StatTile icon="cash-outline" label={t('adminOps.system.revenue')} value={formatMoneyRounded(data.summary.revenue.total, t)} tone="success" />
                        <StatTile icon="receipt-outline" label={t('adminOps.system.avgCheck')} value={formatMoneyRounded(data.summary.revenue.avgCheck, t)} />
                    </StatGrid>

                    <Section title={t('adminOps.analytics.overview.bookingsTrend')} caption={t('adminOps.system.trendsHint')}>
                        <Card variant="plain" padding="md">
                            <BarList
                                emptyLabel={t('adminOps.analytics.overview.bookingsEmpty')}
                                data={data.byDay.map((day) => ({
                                    key: day.date,
                                    label: chartDay(day.date),
                                    value: day.bookingsConfirmed,
                                    display: formatNumber(day.bookingsConfirmed, t.locale),
                                    accessibilityLabel: `${day.date}: ${day.bookingsConfirmed}`,
                                }))}
                                color={CHART_COLOR.bookings}
                                axisMax={formatNumber(maxBookings, t.locale)}
                                valueWidth={48}
                                testID="admin-system-bookings"
                            />
                        </Card>
                    </Section>

                    <Section title={t('adminOps.analytics.overview.revenueTrend')}>
                        <Card variant="plain" padding="md">
                            <BarList
                                emptyLabel={t('adminOps.analytics.overview.revenueEmpty')}
                                data={data.byDay.map((day) => ({
                                    key: day.date,
                                    label: chartDay(day.date),
                                    value: day.totalRevenue,
                                    display: formatMoneyRounded(day.totalRevenue, t),
                                }))}
                                color={CHART_COLOR.revenue}
                                axisMax={formatMoneyRounded(maxRevenue, t)}
                                valueWidth={96}
                            />
                        </Card>
                    </Section>
                </View>
            ) : null}
        </Screen>
    );
}
