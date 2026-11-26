import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { StatusPill } from '../../../components/ui/Badge';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import { KeyValueRow } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { space, typeScale } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { formatTime } from '../../../utils/format';
import { formatNumber } from '../../manage/opsKit/money';
import { fetchPerformance } from './adminOpsApi';
import { ADMIN_TZ, formatPerfValue, perfTone } from './adminOpsLogic';
import { AdminError, adminStyles } from './adminOpsUi';

/**
 * The website's /admin/performance: the measured operations of the last five complete minutes
 * (requests, average, P95 / P99, min / max, unclassified and errors) against the website's
 * thresholds, refreshed every 30 s.
 */
export default function AdminPerformanceScreen() {
    const { t } = useLanguage();
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({ queryKey: ['admin-ops', 'performance'], queryFn: fetchPerformance, refetchInterval: 30_000 });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const data = query.data;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-performance-screen">
            {data ? (
                <ScreenIntro>
                    {`${t('adminOps.common.updatedAt', { time: formatTime(new Date(data.timestamp), ADMIN_TZ) })} · ${t('adminOps.common.autoRefresh')}`}
                </ScreenIntro>
            ) : null}
            {query.isLoading ? (
                <View style={adminStyles.gapMd}>
                    <SkeletonCard lines={4} />
                    <SkeletonCard lines={4} />
                </View>
            ) : !data ? (
                <AdminError title={t('adminOps.performance.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : data.stats.length === 0 ? (
                <EmptyState icon="speedometer-outline" title={t('adminOps.performance.emptyTitle')} message={t('adminOps.performance.emptyDescription')} />
            ) : (
                <View style={adminStyles.gapMd}>
                    {data.stats.map((stat) => {
                        const value = (number: number) => formatPerfValue(number, stat.unit);
                        const p95Tone = perfTone(stat.operation, stat.p95Duration);
                        return (
                            <Card key={`${stat.source}:${stat.operation}`} variant="plain" padding="md" testID={`admin-perf-${stat.operation}`}>
                                <View style={adminStyles.rowBetween}>
                                    <Text style={[adminStyles.mono, styles.title]} numberOfLines={2}>{stat.operation}</Text>
                                    <StatusPill label={`P95 ≈ ${value(stat.p95Duration)}`} tone={p95Tone} />
                                </View>
                                <Text style={styles.source}>
                                    {`${stat.source === 'server' ? t('adminOps.performance.sourceServer') : t('adminOps.performance.sourceBrowser')} · ${t('adminOps.performance.windowNote')}`}
                                </Text>
                                <View style={styles.rows}>
                                    <KeyValueRow label={t('adminOps.performance.requests')} value={formatNumber(stat.count, t.locale)} />
                                    <KeyValueRow label={t('adminOps.performance.avg')} value={value(stat.avgDuration)} tone={tone(perfTone(stat.operation, stat.avgDuration))} />
                                    <KeyValueRow label={t('adminOps.performance.p95')} value={value(stat.p95Duration)} tone={tone(p95Tone)} />
                                    <KeyValueRow label={t('adminOps.performance.p99')} value={value(stat.p99Duration)} tone={tone(perfTone(stat.operation, stat.p99Duration))} />
                                    <KeyValueRow label={t('adminOps.performance.min')} value={value(stat.minDuration)} />
                                    <KeyValueRow label={t('adminOps.performance.max')} value={value(stat.maxDuration)} />
                                    <KeyValueRow label={t('adminOps.performance.unclassified')} value={formatNumber(stat.unknownCount, t.locale)} tone={stat.unknownCount ? 'warning' : undefined} />
                                    <KeyValueRow label={t('adminOps.performance.errors')} value={`${(stat.errorRate * 100).toFixed(1)}%`} tone={stat.errorRate > 0.1 ? 'danger' : undefined} />
                                </View>
                            </Card>
                        );
                    })}
                </View>
            )}
        </Screen>
    );
}

/** A neutral tone leaves the value in the default text colour. */
function tone(value: ReturnType<typeof perfTone>) {
    return value === 'neutral' ? undefined : value;
}

const styles = StyleSheet.create({
    title: { flex: 1, ...typeScale.bodyStrong, color: colors.text.primary },
    source: { ...typeScale.caption, color: colors.text.tertiary, marginTop: space.xs },
    rows: { marginTop: space.md, gap: space.xxs },
});
