import { useState } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import { DateRangeField } from '../../../components/ui/DateTimeFields';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { space } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { fetchDashboardBranches } from '../visitPackages/visitPackagesData';
import { todayInTz } from '../opsKit/dates';
import { useCurrentBusinessReady } from '../opsKit/format';
import { formatMoneyRounded, formatNumber } from '../opsKit/money';
import { BarList, CHART_COLOR, Field, LoadError, ScreenSkeleton } from '../opsKit/ui';
import {
    fetchAnalytics,
    loadByHour,
    PERIOD_PRESETS,
    presetDays,
    presetStart,
    promoShare,
    rangeError,
    type PeriodPreset,
} from './analyticsData';

/** "26.11" for a `YYYY-MM-DD` day of a chart. */
function chartDay(date: string): string {
    return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** The website's /dashboard/analytics: bookings, conversion and revenue of a period, by day, promotions and load by hour. */
export default function ManageAnalyticsScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageAnalytics'>>();
    const { t } = useLanguage();
    const business = useCurrentBusinessReady(params.bizId);
    const [preset, setPreset] = useState<PeriodPreset>('30');
    const [endDate, setEndDate] = useState(() => todayInTz(params.tz));
    const [startDate, setStartDate] = useState(() => presetStart(todayInTz(params.tz), 30));
    const [branchId, setBranchId] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const invalid = rangeError(startDate, endDate);

    const branches = useQuery({
        queryKey: ['manage-branches-list', params.bizId],
        queryFn: fetchDashboardBranches,
        enabled: business.ready,
    });
    const query = useQuery({
        queryKey: ['manage-analytics', params.bizId, startDate, endDate, branchId],
        queryFn: () => fetchAnalytics(startDate, endDate, branchId),
        enabled: business.ready && !invalid,
        placeholderData: keepPreviousData,
    });

    const choosePreset = (value: PeriodPreset) => {
        setPreset(value);
        if (value === 'custom') return;
        const end = todayInTz(params.tz);
        setEndDate(end);
        setStartDate(presetStart(end, presetDays(value)));
    };

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready) return <ScreenSkeleton />;

    const data = query.data;
    const hours = data ? loadByHour(data.load.points) : [];
    const share = data ? promoShare(data.summary) : 0;
    const maxDayBookings = data ? Math.max(0, ...data.byDay.map((point) => point.bookingsConfirmedOrPaid)) : 0;
    const maxDayRevenue = data ? Math.max(0, ...data.byDay.map((point) => point.totalRevenue)) : 0;
    const maxHour = Math.max(0, ...hours.map((row) => row.total));
    const onRefresh = async () => {
        setRefreshing(true);
        try { await Promise.all([query.refetch(), branches.refetch()]); } finally { setRefreshing(false); }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="manage-analytics-screen">
            {/* Filters first: the period (chips + the range picker) and the branch. */}
            <Section gap={space.md}>
                <ChipGroup
                    options={PERIOD_PRESETS.map((key) => ({
                        key,
                        label: t(key === '7' ? 'ops.analytics.days7' : key === '30' ? 'ops.analytics.days30' : key === '90' ? 'ops.analytics.days90' : 'ops.analytics.custom'),
                    }))}
                    value={preset}
                    onChange={choosePreset}
                    accessibilityLabel={t('ops.analytics.period')}
                    testID="analytics-preset"
                />
                <DateRangeField
                    from={startDate}
                    to={endDate}
                    onChange={(range) => { setPreset('custom'); setStartDate(range.from); setEndDate(range.to); }}
                    timeZone={params.tz}
                    fromLabel={t('ops.analytics.start')}
                    toLabel={t('ops.analytics.end')}
                    error={invalid ? t(invalid) : undefined}
                    testID="analytics-range"
                />
                {(branches.data ?? []).length > 0 ? (
                    <Field label={t('ops.analytics.branch')} hint={t('ops.analytics.branchHint')}>
                        <ChipGroup
                            options={[{ key: 'all', label: t('ops.analytics.allBranches') }, ...(branches.data ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                            value={branchId}
                            onChange={setBranchId}
                            accessibilityLabel={t('ops.analytics.branch')}
                            testID="analytics-branch"
                        />
                    </Field>
                ) : null}
            </Section>

            {invalid ? null : query.isLoading ? (
                <View style={{ gap: space.md }} testID="analytics-loading">
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={5} />
                </View>
            ) : query.error && !data ? (
                <LoadError title={t('ops.analytics.loadError')} onRetry={() => void query.refetch()} />
            ) : data ? (
                <View style={{ gap: space.xxl, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    {data.byDay.length === 0 ? (
                        <EmptyState icon="stats-chart" title={t('ops.analytics.emptyTitle')} message={t('ops.analytics.emptyHint')} />
                    ) : (
                        <>
                            <StatGrid>
                                <StatTile icon="add-circle-outline" label={t('ops.analytics.kpi.created')} value={formatNumber(data.summary.bookings.created, t.locale)} />
                                <StatTile icon="checkmark-circle-outline" label={t('ops.analytics.kpi.confirmed')} value={formatNumber(data.summary.bookings.confirmedOrPaid, t.locale)} tone="accent" />
                                <StatTile icon="funnel-outline" label={t('ops.analytics.kpi.conversion')} value={`${formatNumber(data.summary.funnel.conversionHomeToBooking, t.locale)}%`} hint={t('ops.analytics.conversion')} />
                                <StatTile icon="cash-outline" label={t('ops.analytics.kpi.revenue')} value={formatMoneyRounded(data.summary.revenue.total, t)} tone="success" />
                            </StatGrid>

                            <Section title={t('ops.analytics.byDay')}>
                                <Card variant="plain" padding="md">
                                    <BarList
                                        emptyLabel={t('ops.finance.staffStats.noData')}
                                        data={data.byDay.map((point) => ({
                                            key: point.date,
                                            label: chartDay(point.date),
                                            value: point.bookingsConfirmedOrPaid,
                                            display: formatNumber(point.bookingsConfirmedOrPaid, t.locale),
                                            accessibilityLabel: `${point.date}: ${point.bookingsConfirmedOrPaid}`,
                                        }))}
                                        color={CHART_COLOR.bookings}
                                        axisMax={formatNumber(maxDayBookings, t.locale)}
                                        valueWidth={48}
                                        testID="analytics-trend"
                                    />
                                </Card>
                            </Section>

                            <Section title={t('ops.analytics.revenueByDay')}>
                                <StatGrid>
                                    <StatTile label={t('ops.analytics.promoRevenue')} value={formatMoneyRounded(data.summary.revenue.promoRevenue, t)} />
                                    <StatTile label={t('ops.analytics.promoShare')} value={`${formatNumber(share, t.locale)}%`} />
                                </StatGrid>
                                <Card variant="plain" padding="md">
                                    <BarList
                                        emptyLabel={t('ops.finance.staffStats.noData')}
                                        data={data.byDay.map((point) => ({
                                            key: point.date,
                                            label: chartDay(point.date),
                                            value: point.totalRevenue,
                                            display: formatMoneyRounded(point.totalRevenue, t),
                                            accessibilityLabel: `${point.date}: ${formatMoneyRounded(point.totalRevenue, t)}`,
                                        }))}
                                        color={CHART_COLOR.revenue}
                                        axisMax={formatMoneyRounded(maxDayRevenue, t)}
                                        valueWidth={96}
                                        testID="analytics-revenue"
                                    />
                                </Card>
                            </Section>
                        </>
                    )}

                    <Section title={t('ops.analytics.load')} testID="analytics-load">
                        <Card variant="plain" padding="md">
                            <BarList
                                emptyLabel={t('ops.finance.staffStats.noData')}
                                columns={{ label: t('ops.analytics.hour'), value: t('ops.analytics.bookings'), secondary: t('ops.analytics.promotions') }}
                                data={hours.map((row) => ({
                                    key: String(row.hour),
                                    label: `${row.hour}:00`,
                                    value: row.total,
                                    display: row.total ? formatNumber(row.total, t.locale) : '—',
                                    secondary: row.promo ? formatNumber(row.promo, t.locale) : '—',
                                    accessibilityLabel: `${row.hour}:00, ${t('ops.analytics.bookings')} ${row.total}, ${t('ops.analytics.promotions')} ${row.promo}`,
                                }))}
                                color={CHART_COLOR.bookings}
                                axisMax={formatNumber(maxHour, t.locale)}
                                valueWidth={40}
                            />
                        </Card>
                    </Section>
                </View>
            ) : null}
        </Screen>
    );
}
