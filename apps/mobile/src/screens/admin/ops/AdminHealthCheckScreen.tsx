import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { StatusPill } from '../../../components/ui/Badge';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import { KeyValueRow } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { fetchHealthCheck } from './adminOpsApi';
import { cronTone, prettyJson, queueTone } from './adminOpsLogic';
import { AdminError, adminStyles, formatWhen, JsonBlock, MetricDates, Note, OkPill, StatusCard } from './adminOpsUi';

const CRON_STATUS: Record<string, MobileI18nKey> = {
    healthy: 'adminOps.check.cron.healthy',
    running: 'adminOps.check.cron.running',
    failed: 'adminOps.check.cron.failed',
    stuck: 'adminOps.check.cron.stuck',
    overdue: 'adminOps.check.cron.overdue',
    unobserved: 'adminOps.check.cron.unobserved',
    disabled: 'adminOps.check.cron.disabled',
};
const QUEUE_STATUS: Record<string, MobileI18nKey> = {
    disabled: 'adminOps.check.queue.disabled',
    healthy: 'adminOps.check.queue.healthy',
    backlog: 'adminOps.check.queue.backlog',
    failed: 'adminOps.check.queue.failed',
};

/**
 * The website's /admin/health-check: the overall verdict, the alerts with their details, the shift,
 * rating and promotion checks, the background jobs and the queues (GET /api/admin/health-check).
 */
export default function AdminHealthCheckScreen() {
    const { t } = useLanguage();
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({ queryKey: ['admin-ops', 'health-check'], queryFn: fetchHealthCheck });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const data = query.data;

    if (query.isLoading) {
        return (
            <Screen testID="admin-health-check-screen">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={4} />
            </Screen>
        );
    }
    if (!data) {
        return (
            <Screen testID="admin-health-check-screen">
                <AdminError title={t('adminOps.check.error')} error={query.error} onRetry={() => void query.refetch()} />
            </Screen>
        );
    }
    const { checks } = data;
    const tone = data.ok ? 'success' : 'danger';

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-health-check-screen">
            <ScreenIntro>{t('adminOps.check.intro')}</ScreenIntro>

            <Card variant={data.ok ? 'accent' : 'outlined'} padding="md" testID="admin-check-verdict">
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: colors.tone[tone].bg }]}>
                        <Ionicons name={data.ok ? 'checkmark-done' : 'alert-circle'} size={26} color={colors.tone[tone].fg} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.heroTitle}>{data.ok ? t('adminOps.check.healthy') : t('adminOps.check.problems')}</Text>
                        <Text style={styles.heroMeta}>{formatWhen(data.timestamp, t)}</Text>
                    </View>
                </View>
            </Card>

            {data.alerts.length > 0 ? (
                <Section title={t('adminOps.check.alerts')} testID="admin-check-alerts">
                    {data.alerts.map((alert, index) => {
                        const details = prettyJson(alert.details);
                        return (
                            <View key={index} style={adminStyles.gapSm}>
                                <FeedbackBanner
                                    variant={alert.type === 'error' ? 'danger' : 'warning'}
                                    title={alert.type === 'error' ? t('adminOps.common.error') : t('adminOps.common.warning')}
                                    message={alert.message}
                                    compact
                                />
                                {details ? <JsonBlock value={details} /> : null}
                            </View>
                        );
                    })}
                </Section>
            ) : null}

            <Section title={t('adminOps.check.checks')}>
                <StatusCard title={t('adminOps.check.shifts')} ok={checks.shifts.ok} icon="time-outline">
                    <KeyValueRow label={t('adminOps.check.openShifts')} value={String(checks.shifts.openShiftsOlderThan2Days)} />
                </StatusCard>
                <StatusCard title={t('adminOps.check.ratings')} ok={checks.ratings.ok} icon="star-outline">
                    <KeyValueRow
                        label={t('adminOps.check.lastMetric')}
                        value={checks.ratings.daysSinceLastMetric !== null
                            ? t('adminOps.common.daysAgo', { days: checks.ratings.daysSinceLastMetric })
                            : t('adminOps.common.noData')}
                    />
                    <View style={adminStyles.separator} />
                    <MetricDates staff={checks.ratings.staffLastMetricDate} branch={checks.ratings.branchLastMetricDate} biz={checks.ratings.bizLastMetricDate} />
                </StatusCard>
                <StatusCard title={t('adminOps.check.promotions')} ok={checks.promotions.ok} warning icon="pricetags-outline">
                    <KeyValueRow label={t('adminOps.check.activePromotions')} value={String(checks.promotions.activePromotionsCount)} />
                    <KeyValueRow
                        label={t('adminOps.check.lastApplication')}
                        value={checks.promotions.daysSinceLastApplication !== null
                            ? t('adminOps.common.daysAgo', { days: checks.promotions.daysSinceLastApplication })
                            : t('adminOps.common.never')}
                    />
                </StatusCard>
            </Section>

            <Section title={t('adminOps.check.cron')} right={<OkPill ok={checks.cronExecutions.ok} />} testID="admin-check-cron">
                <Card variant="plain" padding="md">
                    {checks.cronExecutions.jobs.map((job, index) => (
                        <View key={job.job}>
                            {index > 0 ? <View style={adminStyles.separator} /> : null}
                            <View style={styles.item}>
                                <View style={adminStyles.rowBetween}>
                                    <Text style={[adminStyles.mono, styles.flex]} numberOfLines={2}>{job.job}</Text>
                                    <StatusPill label={CRON_STATUS[job.status] ? t(CRON_STATUS[job.status]) : job.status} tone={cronTone(job.status)} />
                                </View>
                                <Text style={adminStyles.rowMeta}>{`${t('adminOps.check.cronSuccess')}: ${formatWhen(job.lastSuccessAt, t)}`}</Text>
                            </View>
                        </View>
                    ))}
                </Card>
            </Section>

            <Section title={t('adminOps.check.queues')} right={<OkPill ok={checks.backgroundQueues.ok} />} testID="admin-check-queues">
                <Card variant="plain" padding="md">
                    {checks.backgroundQueues.queues.map((queue, index) => (
                        <View key={queue.job}>
                            {index > 0 ? <View style={adminStyles.separator} /> : null}
                            <View style={styles.item}>
                                <View style={adminStyles.rowBetween}>
                                    <Text style={[adminStyles.mono, styles.flex]} numberOfLines={2}>{queue.job}</Text>
                                    <StatusPill label={QUEUE_STATUS[queue.status] ? t(QUEUE_STATUS[queue.status]) : queue.status} tone={queueTone(queue.status)} />
                                </View>
                                {queue.counts ? (
                                    <>
                                        <KeyValueRow label={t('adminOps.check.queueDue')} value={String(queue.counts.due)} />
                                        <KeyValueRow label={t('adminOps.check.queueFailed')} value={String(queue.counts.failed)} tone={queue.counts.failed > 0 ? 'danger' : undefined} />
                                        <KeyValueRow label={t('adminOps.check.queueAmbiguous')} value={String(queue.counts.ambiguous)} tone={queue.counts.ambiguous > 0 ? 'warning' : undefined} />
                                        <KeyValueRow label={t('adminOps.check.queueAge')} value={String(Math.ceil(queue.counts.oldest_due_age_seconds))} />
                                    </>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </Card>
            </Section>

            <Note>{t('adminOps.check.info')}</Note>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    heroIcon: { width: 52, height: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
    heroTitle: { ...typeScale.headline, color: colors.text.primary },
    heroMeta: { ...typeScale.caption, color: colors.text.tertiary, marginTop: space.xxs },
    item: { gap: space.xs, paddingVertical: space.xs },
});
