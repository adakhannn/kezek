import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import { DateRangeField } from '../../../components/ui/DateTimeFields';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { fetchDashboardBranches } from '../visitPackages/visitPackagesData';
import { todayInTz } from '../opsKit/dates';
import { useCurrentBusinessReady } from '../opsKit/format';
import { formatMoneyRounded, formatNumber } from '../opsKit/money';
import { ChipGroup, Field, LoadError, SectionTitle, ShareBar, StatTile, ui } from '../opsKit/ui';
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

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready) return <LoadingSpinner message={t('common.loading')} />;

    const data = query.data;
    const hours = data ? loadByHour(data.load.points) : [];
    const share = data ? promoShare(data.summary) : 0;
    const maxDayBookings = data ? Math.max(1, ...data.byDay.map((point) => point.bookingsConfirmedOrPaid)) : 1;
    const maxDayRevenue = data ? Math.max(1, ...data.byDay.map((point) => point.totalRevenue)) : 1;
    const onRefresh = async () => {
        setRefreshing(true);
        try { await Promise.all([query.refetch(), branches.refetch()]); } finally { setRefreshing(false); }
    };

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-analytics-screen"
        >
            <Text style={ui.title}>{t('ops.analytics.title')}</Text>
            <Text style={ui.subtitle}>{t('ops.analytics.description')}</Text>

            <Card padding="md">
                <Text style={ui.fieldLabel}>{t('ops.analytics.period')}</Text>
                <Text style={[ui.hint, { marginBottom: colors.layout.space2 }]}>{t('ops.analytics.periodHint')}</Text>
                <ChipGroup
                    options={PERIOD_PRESETS.map((key) => ({
                        key,
                        label: t(key === '7' ? 'ops.analytics.days7' : key === '30' ? 'ops.analytics.days30' : key === '90' ? 'ops.analytics.days90' : 'ops.analytics.custom'),
                    }))}
                    value={preset}
                    onChange={choosePreset}
                    accessibilityLabel={t('ops.analytics.quick')}
                    testID="analytics-preset"
                />
                <View style={{ marginTop: colors.layout.space3, marginBottom: colors.layout.space2 }}>
                    <DateRangeField
                        from={startDate}
                        to={endDate}
                        onChange={(range) => { setPreset('custom'); setStartDate(range.from); setEndDate(range.to); }}
                        timeZone={params.tz}
                        fromLabel={t('ops.analytics.start')}
                        toLabel={t('ops.analytics.end')}
                        testID="analytics-range"
                    />
                </View>
                {(branches.data ?? []).length > 0 ? (
                    <Field label={t('ops.analytics.branch')} hint={t('ops.analytics.branchHint')}>
                        <ChipGroup
                            options={[{ key: 'all', label: t('ops.analytics.allBranches') }, ...(branches.data ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                            value={branchId}
                            onChange={setBranchId}
                            testID="analytics-branch"
                        />
                    </Field>
                ) : null}
            </Card>

            {invalid ? (
                <EmptyState icon="alert-circle" title={t('ops.analytics.error')} message={t(invalid)} />
            ) : query.isLoading ? (
                <LoadingSpinner message={t('ops.analytics.loading')} />
            ) : query.error && !data ? (
                <LoadError title={t('ops.analytics.loadError')} onRetry={() => void query.refetch()} />
            ) : data ? (
                <View style={{ gap: colors.layout.space3, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    {data.byDay.length === 0 ? (
                        <EmptyState icon="stats-chart" title={t('ops.analytics.emptyTitle')} message={t('ops.analytics.emptyHint')} />
                    ) : (
                        <>
                            <View style={ui.tiles}>
                                <StatTile label={t('ops.analytics.created')} value={formatNumber(data.summary.bookings.created, t.locale)} />
                                <StatTile label={t('ops.analytics.confirmed')} value={formatNumber(data.summary.bookings.confirmedOrPaid, t.locale)} />
                                <StatTile label={t('ops.analytics.conversion')} value={`${data.summary.funnel.conversionHomeToBooking.toFixed(2)}%`} />
                                <StatTile label={t('ops.analytics.revenue')} value={formatMoneyRounded(data.summary.revenue.total, t)} />
                            </View>

                            <Card padding="md">
                                <SectionTitle>{t('ops.analytics.trend')}</SectionTitle>
                                <Text style={ui.hint}>{t('ops.analytics.trendHint')}</Text>
                                {data.byDay.map((point) => (
                                    <View key={point.date} style={ui.listRow} accessible accessibilityLabel={`${point.date}: ${point.bookingsConfirmedOrPaid}`}>
                                        <Text style={[ui.muted, { width: 92 }]}>{point.date}</Text>
                                        <ShareBar share={point.bookingsConfirmedOrPaid / maxDayBookings} />
                                        <Text style={[ui.text, { width: 48, textAlign: 'right' }]}>{formatNumber(point.bookingsConfirmedOrPaid, t.locale)}</Text>
                                    </View>
                                ))}
                            </Card>

                            <Card padding="md">
                                <SectionTitle>{t('ops.analytics.promo')}</SectionTitle>
                                <Text style={ui.hint}>{t('ops.analytics.promoHint')}</Text>
                                <View style={[ui.tiles, { marginTop: colors.layout.space2 }]}>
                                    <StatTile label={t('ops.analytics.promoRevenue')} value={formatMoneyRounded(data.summary.revenue.promoRevenue, t)} />
                                    <StatTile label={t('ops.analytics.promoShare')} value={`${share.toFixed(2)}%`} />
                                </View>
                                {data.byDay.map((point) => (
                                    <View key={point.date} style={ui.listRow} accessible accessibilityLabel={`${point.date}: ${formatMoneyRounded(point.totalRevenue, t)}`}>
                                        <Text style={[ui.muted, { width: 92 }]}>{point.date}</Text>
                                        <ShareBar share={point.totalRevenue / maxDayRevenue} color={colors.status.success} />
                                        <Text style={[ui.text, { minWidth: 72, textAlign: 'right' }]}>{formatMoneyRounded(point.totalRevenue, t)}</Text>
                                    </View>
                                ))}
                            </Card>
                        </>
                    )}

                    <Card padding="md" testID="analytics-load">
                        <SectionTitle>{t('ops.analytics.load')}</SectionTitle>
                        <Text style={ui.hint}>{t('ops.analytics.loadHint')}</Text>
                        <View style={[ui.listRow, { borderBottomWidth: 0 }]}>
                            <Text style={[ui.fieldLabel, { width: 56 }]}>{t('ops.analytics.hour')}</Text>
                            <Text style={[ui.fieldLabel, { flex: 1 }]}>{t('ops.analytics.bookings')}</Text>
                            <Text style={[ui.fieldLabel, { width: 84, textAlign: 'right' }]}>{t('ops.analytics.promotions')}</Text>
                        </View>
                        {hours.map((row) => (
                            <View
                                key={row.hour}
                                style={ui.listRow}
                                accessible
                                accessibilityLabel={`${row.hour}:00, ${t('ops.analytics.bookings')} ${row.total}, ${t('ops.analytics.promotions')} ${row.promo}`}
                            >
                                <Text style={[ui.muted, { width: 56 }]}>{row.hour}:00</Text>
                                <View style={[ui.row, { flex: 1 }]}>
                                    <ShareBar share={row.intensity} color={colors.status.success} />
                                    <Text style={[ui.text, { width: 40, textAlign: 'right' }]}>{row.total ? formatNumber(row.total, t.locale) : '—'}</Text>
                                </View>
                                <Text style={[ui.text, { width: 84, textAlign: 'right' }]}>{row.promo ? formatNumber(row.promo, t.locale) : '—'}</Text>
                            </View>
                        ))}
                    </Card>
                </View>
            ) : null}
        </ScrollView>
    );
}
