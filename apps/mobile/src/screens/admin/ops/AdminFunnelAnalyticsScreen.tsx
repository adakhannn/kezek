import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatNumber } from '../../manage/opsKit/money';
import { Field, ShareBar } from '../../manage/opsKit/ui';
import { fetchFunnelEvents, type FunnelSource } from './adminOpsApi';
import { conversionTone } from './adminOpsLogic';
import { AdminError, adminStyles, PeriodFilter, usePeriod } from './adminOpsUi';

const STEP: Record<string, MobileI18nKey> = {
    business_view: 'adminOps.funnelEvents.step.business_view',
    branch_select: 'adminOps.funnelEvents.step.branch_select',
    service_select: 'adminOps.funnelEvents.step.service_select',
    staff_select: 'adminOps.funnelEvents.step.staff_select',
    slot_select: 'adminOps.funnelEvents.step.slot_select',
    booking_success: 'adminOps.funnelEvents.step.booking_success',
};

/**
 * The website's /admin/funnel-analytics: the booking steps of every business (funnel_events) over
 * the whole history or a period, by source (public flow or QuickDesk), with the step conversion.
 */
export default function AdminFunnelAnalyticsScreen() {
    const { t } = useLanguage();
    const period = usePeriod({ allTime: true });
    const [source, setSource] = useState<FunnelSource>('all');
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['admin-ops', 'funnel-events', period.startDate, period.endDate, source],
        queryFn: () => fetchFunnelEvents({ startDate: period.startDate || undefined, endDate: period.endDate || undefined }, source),
        enabled: !period.invalid,
        placeholderData: keepPreviousData,
    });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const data = query.data;
    const first = data?.funnel[0]?.uniqueSessions || 1;
    const hasEvents = !!data && data.summary.totalEvents > 0;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-funnel-events-screen">
            <ScreenIntro>{t('adminOps.funnelEvents.intro')}</ScreenIntro>
            <Section gap={space.md}>
                <PeriodFilter period={period} allTime testID="admin-funnel-period" />
                <Field label={t('adminOps.funnelEvents.source')}>
                    <ChipGroup
                        options={[
                            { key: 'all', label: t('adminOps.funnelEvents.sourceAll') },
                            { key: 'public', label: t('adminOps.funnelEvents.sourcePublic') },
                            { key: 'quickdesk', label: t('adminOps.funnelEvents.sourceQuickdesk') },
                        ]}
                        value={source}
                        onChange={setSource}
                        accessibilityLabel={t('adminOps.funnelEvents.source')}
                        testID="admin-funnel-source"
                    />
                </Field>
            </Section>

            {period.invalid ? null : query.isLoading ? (
                <View style={adminStyles.gapMd}>
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={6} />
                </View>
            ) : query.error && !data ? (
                <AdminError title={t('adminOps.funnelEvents.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : data ? (
                <View style={{ gap: space.xxl, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    <StatGrid>
                        <StatTile icon="eye-outline" label={t('adminOps.funnelEvents.totalViews')} value={formatNumber(data.summary.totalViews, t.locale)} />
                        <StatTile icon="checkmark-circle-outline" label={t('adminOps.funnelEvents.successfulBookings')} value={formatNumber(data.summary.totalBookings, t.locale)} tone="accent" />
                        <StatTile
                            icon="trending-up-outline"
                            label={t('adminOps.funnelEvents.overallConversion')}
                            value={`${data.summary.overallConversionRate.toFixed(2)}%`}
                            tone={conversionTone(data.summary.overallConversionRate)}
                        />
                        <StatTile icon="pulse-outline" label={t('adminOps.funnelEvents.totalEvents')} value={formatNumber(data.summary.totalEvents, t.locale)} />
                    </StatGrid>

                    {!hasEvents ? (
                        <EmptyState icon="funnel-outline" title={t('adminOps.funnelEvents.emptyTitle')} message={t('adminOps.funnelEvents.emptyDescription')} />
                    ) : (
                        <Section title={t('adminOps.funnelEvents.chart')} caption={t('adminOps.funnelEvents.chartHint')}>
                            <Card variant="plain" padding="md">
                                {data.funnel.map((step, index) => {
                                    const label = STEP[step.step] ? t(STEP[step.step]) : step.stepName;
                                    const tone = conversionTone(step.conversionRate);
                                    return (
                                        <View key={step.step} testID={`admin-funnel-step-${step.step}`}>
                                            {index > 0 ? <View style={adminStyles.separator} /> : null}
                                            <View style={styles.step}>
                                                <View style={styles.head}>
                                                    <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                                                    <View style={styles.flex}>
                                                        <Text style={adminStyles.rowTitle} numberOfLines={2}>{label}</Text>
                                                        <Text style={adminStyles.rowMeta}>
                                                            {t('adminOps.funnelEvents.stepSessions', { count: formatNumber(step.uniqueSessions, t.locale) })}
                                                            {' · '}
                                                            {t('adminOps.funnelEvents.stepEvents', { count: formatNumber(step.totalEvents, t.locale) })}
                                                        </Text>
                                                    </View>
                                                    {index > 0 ? (
                                                        <Text
                                                            style={[styles.rate, { color: colors.tone[tone].fg }]}
                                                            accessibilityLabel={t('adminOps.funnelEvents.fromPrev', { value: `${step.conversionRate.toFixed(2)}%` })}
                                                        >
                                                            {`${step.conversionRate.toFixed(2)}%`}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <ShareBar share={Math.min(step.uniqueSessions / first, 1)} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </Card>
                        </Section>
                    )}
                </View>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    step: { gap: space.sm, paddingVertical: space.xs },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    number: { width: 28, height: 28, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tone.accent.bg },
    numberText: { ...typeScale.caption, fontWeight: '600', color: colors.tone.accent.fg },
    rate: { ...typeScale.bodyStrong, fontVariant: ['tabular-nums'] },
});
