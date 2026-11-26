import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow, { KeyValueRow, ListGroup } from '../../../components/ui/ListRow';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatMoneyRounded, formatNumber } from '../../manage/opsKit/money';
import { BarList, CHART_COLOR, ShareBar } from '../../manage/opsKit/ui';
import {
    fetchBusinessFunnel,
    fetchBusinessLoad,
    fetchBusinessPromotions,
    fetchGlobalOverview,
    type FunnelChannel,
    type GlobalOverviewDay,
    type Period,
} from './adminOpsApi';
import { bookingsByHour, buildHeatmap, nextSort, percentOf, sortPromotions, type HeatmapMode, type PromoSortKey, type SortDir } from './adminOpsLogic';
import { AdminError, adminStyles } from './adminOpsUi';
import LoadHeatmap from './LoadHeatmap';

/*
 * The four tabs of the website's /admin/analytics: the overview of every business, then the
 * funnel, the occupancy and the promotions of the current business. Each tab reads its own route.
 */

/** "26.11" for a `YYYY-MM-DD` day of a chart. */
function chartDay(date: string): string {
    return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

function Loading({ testID }: { testID?: string }) {
    return (
        <View style={adminStyles.gapMd} testID={testID}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={5} />
        </View>
    );
}

/* ---------- overview ---------- */

const RAW_COLUMNS: { key: keyof GlobalOverviewDay; label: MobileI18nKey }[] = [
    { key: 'homeViews', label: 'adminOps.analytics.raw.home' },
    { key: 'businessPageViews', label: 'adminOps.analytics.raw.biz' },
    { key: 'bookingFlowStarts', label: 'adminOps.analytics.raw.starts' },
    { key: 'bookingsCreated', label: 'adminOps.analytics.raw.created' },
    { key: 'bookingsConfirmedOrPaid', label: 'adminOps.analytics.raw.confirmed' },
    { key: 'promoBookings', label: 'adminOps.analytics.raw.promoBookings' },
    { key: 'promoRevenue', label: 'adminOps.analytics.raw.promoRevenue' },
    { key: 'totalRevenue', label: 'adminOps.analytics.raw.totalRevenue' },
];

export function OverviewTab({ period }: { period: Period }) {
    const { t } = useLanguage();
    const [raw, setRaw] = useState(false);
    const query = useQuery({
        queryKey: ['admin-ops', 'analytics', 'overview', period.startDate, period.endDate],
        queryFn: () => fetchGlobalOverview(period),
        placeholderData: keepPreviousData,
    });
    if (query.isLoading) return <Loading testID="admin-overview-loading" />;
    if (query.error && !query.data) return <AdminError title={t('adminOps.analytics.overview.error')} error={query.error} onRetry={() => void query.refetch()} />;
    const data = query.data;
    if (!data) return null;
    const { summary, byDay } = data;
    const share = percentOf(summary.revenue.promoRevenue, summary.revenue.total);
    const maxBookings = Math.max(0, ...byDay.map((day) => day.bookingsConfirmedOrPaid));
    const maxRevenue = Math.max(0, ...byDay.map((day) => day.totalRevenue));
    const shares = byDay.map((day) => percentOf(day.promoBookings, day.bookingsConfirmedOrPaid));

    return (
        <View style={[styles.tab, { opacity: query.isPlaceholderData ? 0.6 : 1 }]} testID="admin-overview">
            <StatGrid>
                <StatTile
                    icon="checkmark-circle-outline"
                    label={t('adminOps.analytics.successfulBookings')}
                    value={formatNumber(summary.bookings.confirmedOrPaid, t.locale)}
                    hint={t('adminOps.analytics.overview.createdHint', { count: formatNumber(summary.bookings.created, t.locale) })}
                    tone="accent"
                />
                <StatTile
                    icon="funnel-outline"
                    label={t('adminOps.analytics.overview.conversion')}
                    value={`${summary.funnel.conversionHomeToBooking.toFixed(2)}%`}
                    hint={t('adminOps.analytics.overview.conversionHint', {
                        views: formatNumber(summary.funnel.homeViews, t.locale),
                        bookings: formatNumber(summary.bookings.confirmedOrPaid, t.locale),
                    })}
                    tone="success"
                />
                <StatTile
                    icon="cash-outline"
                    label={t('adminOps.analytics.overview.revenue')}
                    value={formatMoneyRounded(summary.revenue.total, t)}
                    hint={t('adminOps.analytics.overview.revenueHint', { amount: formatMoneyRounded(summary.revenue.promoRevenue, t) })}
                />
                <StatTile
                    icon="pricetag-outline"
                    label={t('adminOps.analytics.overview.promoShare')}
                    value={`${share.toFixed(2)}%`}
                    hint={t('adminOps.analytics.overview.promoShareHint', { count: formatNumber(summary.revenue.promoBookings, t.locale) })}
                    tone="warning"
                />
            </StatGrid>

            <Section title={t('adminOps.analytics.overview.bookingsTrend')}>
                <Card variant="plain" padding="md">
                    <BarList
                        emptyLabel={t('adminOps.analytics.overview.bookingsEmpty')}
                        data={byDay.map((day) => ({
                            key: day.date,
                            label: chartDay(day.date),
                            value: day.bookingsConfirmedOrPaid,
                            display: formatNumber(day.bookingsConfirmedOrPaid, t.locale),
                            accessibilityLabel: `${day.date}: ${day.bookingsConfirmedOrPaid}`,
                        }))}
                        color={CHART_COLOR.bookings}
                        axisMax={formatNumber(maxBookings, t.locale)}
                        valueWidth={48}
                        testID="admin-overview-bookings"
                    />
                </Card>
            </Section>

            <Section title={t('adminOps.analytics.overview.revenueTrend')}>
                <Card variant="plain" padding="md">
                    <BarList
                        emptyLabel={t('adminOps.analytics.overview.revenueEmpty')}
                        data={byDay.map((day) => ({
                            key: day.date,
                            label: chartDay(day.date),
                            value: day.totalRevenue,
                            display: formatMoneyRounded(day.totalRevenue, t),
                            accessibilityLabel: `${day.date}: ${formatMoneyRounded(day.totalRevenue, t)}`,
                        }))}
                        color={CHART_COLOR.revenue}
                        axisMax={formatMoneyRounded(maxRevenue, t)}
                        valueWidth={96}
                    />
                </Card>
            </Section>

            <Section title={t('adminOps.analytics.overview.promoTrend')}>
                <Card variant="plain" padding="md">
                    <BarList
                        emptyLabel={t('adminOps.analytics.overview.promoEmpty')}
                        data={byDay.map((day, index) => ({
                            key: day.date,
                            label: chartDay(day.date),
                            value: shares[index],
                            display: `${shares[index].toFixed(2)}%`,
                        }))}
                        color={CHART_COLOR.promo}
                        axisMax={`${Math.max(0, ...shares).toFixed(2)}%`}
                        valueWidth={64}
                    />
                </Card>
            </Section>

            {byDay.length > 0 ? (
                <View style={adminStyles.gapMd}>
                    <ListGroup>
                        <ListRow
                            icon="grid-outline"
                            title={t('adminOps.analytics.overview.rawData')}
                            subtitle={t('adminOps.analytics.overview.rawDataHint')}
                            onPress={() => setRaw((value) => !value)}
                            chevron={false}
                            trailing={<Ionicons name={raw ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.tertiary} />}
                            testID="admin-overview-raw-toggle"
                        />
                    </ListGroup>
                    {raw ? (
                        <Card variant="plain" padding="none">
                            <ScrollView horizontal contentContainerStyle={styles.table} testID="admin-overview-raw">
                                <View>
                                    <View style={styles.tableRow}>
                                        <Text style={[styles.th, styles.dateCell]}>{t('adminOps.analytics.overview.date')}</Text>
                                        {RAW_COLUMNS.map((column) => <Text key={column.key} style={[styles.th, styles.numCell]}>{t(column.label)}</Text>)}
                                    </View>
                                    {byDay.map((day) => (
                                        <View key={day.date} style={[styles.tableRow, styles.tableBodyRow]}>
                                            <Text style={[styles.td, styles.dateCell]}>{day.date}</Text>
                                            {RAW_COLUMNS.map((column) => (
                                                <Text key={column.key} style={[styles.td, styles.numCell]}>{String(day[column.key])}</Text>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </Card>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

/* ---------- funnel of the current business ---------- */

const FUNNEL_STEP: Record<string, MobileI18nKey> = {
    home_view: 'adminOps.analytics.funnel.step.home_view',
    business_page_view: 'adminOps.analytics.funnel.step.business_page_view',
    booking_flow_start: 'adminOps.analytics.funnel.step.booking_flow_start',
    booking_created: 'adminOps.analytics.funnel.step.booking_created',
    booking_confirmed_or_paid: 'adminOps.analytics.funnel.step.booking_confirmed_or_paid',
};

export function FunnelTab({ period, channel }: { period: Period; channel: FunnelChannel }) {
    const { t } = useLanguage();
    const query = useQuery({
        queryKey: ['admin-ops', 'analytics', 'funnel', period.startDate, period.endDate, channel],
        queryFn: () => fetchBusinessFunnel(period, channel),
        placeholderData: keepPreviousData,
    });
    if (query.isLoading) return <Loading />;
    if (query.error && !query.data) return <AdminError title={t('adminOps.analytics.funnel.error')} error={query.error} onRetry={() => void query.refetch()} />;
    const data = query.data;
    if (!data) return null;
    const maxSessions = Math.max(0, ...data.steps.map((step) => step.sessions));
    const pct = (value: number | null) => (value == null ? '—' : `${value.toFixed(2)}%`);

    return (
        <View style={[styles.tab, { opacity: query.isPlaceholderData ? 0.6 : 1 }]} testID="admin-funnel">
            <StatTile
                icon="trending-up-outline"
                label={t('adminOps.analytics.funnel.overall')}
                value={pct(data.overallConversion)}
                hint={t('adminOps.analytics.funnel.overallHint')}
                tone="success"
            />
            <Section title={t('adminOps.analytics.funnel.steps')} caption={t('adminOps.analytics.funnel.stepsHint')}>
                {data.steps.length === 0 ? (
                    <EmptyState
                        compact
                        icon="funnel-outline"
                        title={t('adminOps.analytics.funnel.emptyTitle')}
                        message={t('adminOps.analytics.funnel.emptyDescription')}
                    />
                ) : (
                    <Card variant="plain" padding="md">
                        {data.steps.map((step, index) => {
                            const label = FUNNEL_STEP[step.id] ? t(FUNNEL_STEP[step.id]) : step.label;
                            const first = index === 0;
                            const rate = first ? data.overallConversion : step.conversionFromPrev;
                            return (
                                <View key={step.id}>
                                    {index > 0 ? <View style={adminStyles.separator} /> : null}
                                    <View
                                        style={styles.step}
                                        accessible
                                        accessibilityLabel={`${index + 1}. ${label}: ${t('adminOps.analytics.funnel.sessions', { count: step.sessions })}, ${first ? t('adminOps.analytics.funnel.funnelStart') : t('adminOps.analytics.funnel.fromPrev')} ${pct(rate)}`}
                                    >
                                        <View style={styles.stepHead}>
                                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
                                            <View style={styles.flex}>
                                                <Text style={adminStyles.rowTitle} numberOfLines={2}>{label}</Text>
                                                <Text style={adminStyles.rowMeta}>{t('adminOps.analytics.funnel.sessions', { count: formatNumber(step.sessions, t.locale) })}</Text>
                                            </View>
                                            <View style={styles.stepRate}>
                                                <Text style={adminStyles.rowMeta} numberOfLines={1}>
                                                    {first ? t('adminOps.analytics.funnel.funnelStart') : t('adminOps.analytics.funnel.fromPrev')}
                                                </Text>
                                                <Text style={[styles.rate, { color: first ? colors.tone.success.fg : colors.tone.accent.fg }]}>{pct(rate)}</Text>
                                            </View>
                                        </View>
                                        <ShareBar share={maxSessions > 0 ? Math.max(step.sessions / maxSessions, 0.05) : 0} />
                                    </View>
                                </View>
                            );
                        })}
                    </Card>
                )}
            </Section>
        </View>
    );
}

/* ---------- occupancy of the current business ---------- */

export function LoadTab({ period, branchId, mode }: { period: Period; branchId: string; mode: HeatmapMode }) {
    const { t } = useLanguage();
    const query = useQuery({
        queryKey: ['admin-ops', 'analytics', 'load', period.startDate, period.endDate, branchId],
        queryFn: () => fetchBusinessLoad(period, branchId),
        placeholderData: keepPreviousData,
    });
    const heatmap = useMemo(() => buildHeatmap(query.data?.points ?? [], mode), [query.data, mode]);
    if (query.isLoading) return <Loading />;
    if (query.error && !query.data) return <AdminError title={t('adminOps.analytics.load.error')} error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data) return null;
    const hours = bookingsByHour(query.data.points);
    const maxHour = Math.max(0, ...hours);

    return (
        <View style={[styles.tab, { opacity: query.isPlaceholderData ? 0.6 : 1 }]} testID="admin-load">
            <Section title={t('adminOps.analytics.load.heatmap')} caption={t('adminOps.analytics.load.heatmapHint')}>
                {heatmap.rows.length === 0 ? (
                    <EmptyState
                        compact
                        icon="grid-outline"
                        title={t('adminOps.analytics.load.emptyTitle')}
                        message={t('adminOps.analytics.load.emptyDescription')}
                    />
                ) : (
                    <Card variant="plain" padding="md">
                        <LoadHeatmap rows={heatmap.rows} max={heatmap.max} mode={mode} testID="admin-heatmap" />
                    </Card>
                )}
            </Section>
            {heatmap.rows.length > 0 ? (
                <Section title={t('adminOps.analytics.load.byHour')}>
                    <Card variant="plain" padding="md">
                        <BarList
                            emptyLabel={t('adminOps.analytics.load.emptyTitle')}
                            data={hours.map((total, hour) => ({
                                key: String(hour),
                                label: `${hour}:00`,
                                value: total,
                                display: total ? formatNumber(total, t.locale) : '—',
                            }))}
                            axisMax={formatNumber(maxHour, t.locale)}
                            valueWidth={44}
                        />
                    </Card>
                </Section>
            ) : null}
        </View>
    );
}

/* ---------- promotions of the current business ---------- */

const SORT_KEYS: { key: PromoSortKey; label: MobileI18nKey }[] = [
    { key: 'revenue', label: 'adminOps.analytics.promo.revenue' },
    { key: 'bookings', label: 'adminOps.analytics.promo.bookings' },
    { key: 'discount', label: 'adminOps.analytics.promo.discounts' },
    { key: 'type', label: 'adminOps.analytics.promo.type' },
];

export function PromotionsTab({ period, branchId }: { period: Period; branchId: string }) {
    const { t } = useLanguage();
    const [typeFilter, setTypeFilter] = useState('all');
    const [sort, setSort] = useState<{ key: PromoSortKey; dir: SortDir }>({ key: 'revenue', dir: 'desc' });
    const query = useQuery({
        queryKey: ['admin-ops', 'analytics', 'promotions', period.startDate, period.endDate, branchId],
        queryFn: () => fetchBusinessPromotions(period, branchId),
        placeholderData: keepPreviousData,
    });
    if (query.isLoading) return <Loading />;
    if (query.error && !query.data) return <AdminError title={t('adminOps.analytics.promo.error')} error={query.error} onRetry={() => void query.refetch()} />;
    const data = query.data;
    if (!data) return null;
    const { summary } = data;
    const byType = data.byType ?? [];
    const types = [...new Set(byType.map((row) => row.promotionType))].sort();
    // A type of the previous period that is gone falls back to every type, as the website resets it.
    const filter = typeFilter === 'all' || types.includes(typeFilter) ? typeFilter : 'all';
    const rows = sortPromotions(byType, filter, sort.key, sort.dir);
    const arrow = sort.dir === 'asc' ? ' ↑' : ' ↓';

    return (
        <View style={[styles.tab, { opacity: query.isPlaceholderData ? 0.6 : 1 }]} testID="admin-promotions">
            <StatGrid>
                <StatTile icon="pricetags-outline" label={t('adminOps.analytics.promo.bookingsKpi')} value={formatNumber(summary.promoBookings, t.locale)} tone="accent" />
                <StatTile icon="cash-outline" label={t('adminOps.analytics.promo.revenue')} value={formatMoneyRounded(summary.promoRevenue, t)} tone="success" />
                <StatTile label={t('adminOps.analytics.promo.nonPromoRevenue')} value={formatMoneyRounded(summary.totalRevenue - summary.promoRevenue, t)} />
                <StatTile
                    label={t('adminOps.analytics.promo.share')}
                    value={`${percentOf(summary.promoRevenue, summary.totalRevenue).toFixed(2)}%`}
                    hint={t('adminOps.analytics.promo.totalHint', { amount: formatMoneyRounded(summary.totalRevenue, t) })}
                    tone="warning"
                />
            </StatGrid>

            <Section title={t('adminOps.analytics.promo.byType')} caption={t('adminOps.analytics.promo.byTypeHint')}>
                {types.length > 1 ? (
                    <ChipGroup
                        options={[{ key: 'all', label: t('adminOps.analytics.promo.allTypes') }, ...types.map((type) => ({ key: type, label: type }))]}
                        value={filter}
                        onChange={setTypeFilter}
                        accessibilityLabel={t('adminOps.analytics.promo.type')}
                        testID="admin-promo-type"
                    />
                ) : null}
                {rows.length > 1 ? (
                    <ChipGroup
                        options={SORT_KEYS.map((item) => ({ key: item.key, label: `${t(item.label)}${item.key === sort.key ? arrow : ''}` }))}
                        value={sort.key}
                        onChange={(key) => setSort((current) => nextSort(current, key))}
                        accessibilityLabel={`${t('adminOps.analytics.promo.sort')}: ${t(sort.dir === 'asc' ? 'adminOps.analytics.promo.sortAsc' : 'adminOps.analytics.promo.sortDesc')}`}
                        testID="admin-promo-sort"
                    />
                ) : null}
                {rows.length === 0 ? (
                    <EmptyState
                        compact
                        icon="pricetag-outline"
                        title={t('adminOps.analytics.promo.emptyTitle')}
                        message={t('adminOps.analytics.promo.emptyDescription')}
                    />
                ) : (
                    <Card variant="plain" padding="md">
                        {rows.map((row, index) => {
                            const share = percentOf(row.revenue, summary.promoRevenue);
                            return (
                                <View key={row.promotionType} style={adminStyles.gapSm} testID={`admin-promo-row-${row.promotionType}`}>
                                    {index > 0 ? <View style={adminStyles.separator} /> : null}
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={[adminStyles.rowTitle, styles.flex]} numberOfLines={1}>{row.promotionType}</Text>
                                        <Text style={styles.share} accessibilityLabel={`${t('adminOps.analytics.promo.shareInPromo')}: ${share.toFixed(2)}%`}>
                                            {`${share.toFixed(2)}%`}
                                        </Text>
                                    </View>
                                    <ShareBar share={share / 100} color={CHART_COLOR.revenue} />
                                    <KeyValueRow label={t('adminOps.analytics.promo.bookings')} value={formatNumber(row.bookings, t.locale)} />
                                    <KeyValueRow label={t('adminOps.analytics.promo.revenue')} value={formatMoneyRounded(row.revenue, t)} tone="success" />
                                    <KeyValueRow label={t('adminOps.analytics.promo.discounts')} value={formatMoneyRounded(row.discountGiven, t)} tone="danger" />
                                </View>
                            );
                        })}
                    </Card>
                )}
            </Section>
        </View>
    );
}

const styles = StyleSheet.create({
    tab: { gap: space.xxl },
    flex: { flex: 1 },
    table: { padding: space.md },
    tableRow: { flexDirection: 'row' },
    tableBodyRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
    th: { ...typeScale.overline, color: colors.text.tertiary, paddingVertical: space.xs },
    td: { ...typeScale.caption, color: colors.text.primary, paddingVertical: space.xs, fontVariant: ['tabular-nums'] },
    dateCell: { width: 92 },
    numCell: { width: 76, textAlign: 'right' },
    step: { gap: space.sm, paddingVertical: space.xs },
    stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    stepNumberText: { ...typeScale.caption, fontWeight: '600', color: colors.tone.accent.fg },
    stepRate: { alignItems: 'flex-end', maxWidth: '40%' },
    rate: { ...typeScale.bodyStrong, fontVariant: ['tabular-nums'] },
    share: { ...typeScale.callout, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
});
