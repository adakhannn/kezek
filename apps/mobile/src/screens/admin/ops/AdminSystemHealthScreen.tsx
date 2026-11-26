import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import ListRow, { KeyValueRow, ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage, type Translate } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { formatTime } from '../../../utils/format';
import { formatNumber } from '../../manage/opsKit/money';
import { fetchSystemHealth, type IntegrationHealth } from './adminOpsApi';
import { ADMIN_TZ, formatDuration } from './adminOpsLogic';
import { AdminError, adminStyles, formatWhen, MetricDates, Note, OkPill, StatusCard } from './adminOpsUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function integrationLines(item: IntegrationHealth, t: Translate): string[] {
    const state = item.configured
        ? item.providerReachable
            ? t('adminOps.health.reachable')
            : item.providerMessage || t('adminOps.health.notResponding')
        : item.providerMessage || t('adminOps.health.notConfigured');
    return [
        state,
        t('adminOps.health.lastSuccess', { date: formatWhen(item.lastSuccessDate, t, '—') }),
        item.recentFailures > 0 ? t('adminOps.health.failures', { count: item.recentFailures }) : t('adminOps.health.noFailures'),
    ];
}

/**
 * The website's /admin/system-health: the overall status, the shift and rating jobs, API metrics
 * of the last hour, UI errors and the WhatsApp / Telegram integrations, refreshed every 30 s.
 */
export default function AdminSystemHealthScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({ queryKey: ['admin-ops', 'system-health'], queryFn: fetchSystemHealth, refetchInterval: 30_000 });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const data = query.data;

    if (query.isLoading) {
        return (
            <Screen testID="admin-system-health-screen">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={4} />
                <SkeletonCard lines={4} />
            </Screen>
        );
    }
    if (!data) {
        return (
            <Screen testID="admin-system-health-screen">
                <AdminError title={t('adminOps.health.error')} error={query.error} onRetry={() => void query.refetch()} />
            </Screen>
        );
    }

    const cronOk = data.cronJobs.shifts.ok && data.cronJobs.ratings.ok;
    const integrationsOk = data.integrations.whatsapp.ok && data.integrations.telegram.ok;
    const ratings = data.cronJobs.ratings;
    const updatedAt = query.dataUpdatedAt ? formatTime(new Date(query.dataUpdatedAt), ADMIN_TZ) : null;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-system-health-screen">
            <ScreenIntro>{t('adminOps.health.intro')}</ScreenIntro>

            <Card variant={data.ok ? 'accent' : 'outlined'} padding="md" testID="admin-health-overall">
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: colors.tone[data.ok ? 'success' : 'danger'].bg }]}>
                        <Ionicons name={data.ok ? 'shield-checkmark' : 'warning'} size={26} color={colors.tone[data.ok ? 'success' : 'danger'].fg} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.heroTitle}>{t('adminOps.health.overall')}</Text>
                        <Text style={styles.heroText}>{data.ok ? t('adminOps.health.overallOk') : t('adminOps.health.overallProblems')}</Text>
                    </View>
                </View>
                <Text style={styles.heroMeta}>
                    {updatedAt ? `${t('adminOps.common.updatedAt', { time: updatedAt })} · ` : ''}{t('adminOps.common.autoRefresh')}
                </Text>
            </Card>

            <Section title={t('adminOps.health.cron')} right={<OkPill ok={cronOk} />}>
                <StatusCard title={t('adminOps.health.cronShifts')} ok={data.cronJobs.shifts.ok} icon="time-outline" testID="admin-health-shifts">
                    <Note>{t('adminOps.health.openShifts', { count: data.cronJobs.shifts.openShiftsOlderThan2Days })}</Note>
                    <Note>{t('adminOps.health.lastCheck', { date: formatWhen(data.cronJobs.shifts.lastCheckDate, t) })}</Note>
                </StatusCard>
                <StatusCard title={t('adminOps.health.cronRatings')} ok={ratings.ok} icon="star-outline" testID="admin-health-ratings">
                    <Note>
                        {ratings.daysSinceLastMetric !== null
                            ? t('adminOps.health.lastRecalc', { days: ratings.daysSinceLastMetric })
                            : t('adminOps.health.neverRecalculated')}
                    </Note>
                    <View style={adminStyles.separator} />
                    <MetricDates staff={ratings.staffLastMetricDate} branch={ratings.branchLastMetricDate} biz={ratings.bizLastMetricDate} />
                </StatusCard>
            </Section>

            <Section title={t('adminOps.health.api')} right={<OkPill ok={data.apiMetrics.ok} />} testID="admin-health-api">
                <StatGrid>
                    <StatTile label={t('adminOps.health.totalRequests')} value={formatNumber(data.apiMetrics.totalRequests, t.locale)} tone={data.apiMetrics.ok ? 'neutral' : 'danger'} />
                    <StatTile label={t('adminOps.health.errorRate')} value={`${data.apiMetrics.errorRate.toFixed(2)}%`} tone={data.apiMetrics.ok ? 'neutral' : 'danger'} />
                    <StatTile label={t('adminOps.health.avgDuration')} value={formatDuration(data.apiMetrics.avgDuration)} />
                    <StatTile label={t('adminOps.health.recentErrors')} value={formatNumber(data.apiMetrics.recentErrors, t.locale)} tone={data.apiMetrics.recentErrors > 0 ? 'danger' : 'neutral'} />
                    <StatTile label={t('adminOps.health.p95')} value={formatDuration(data.apiMetrics.p95Duration)} />
                    <StatTile label={t('adminOps.health.p99')} value={formatDuration(data.apiMetrics.p99Duration)} />
                </StatGrid>
            </Section>

            <Section title={t('adminOps.health.ui')} right={<OkPill ok={data.uiErrors.ok} />}>
                <Card variant="plain" padding="md">
                    <KeyValueRow label={t('adminOps.health.uiErrors')} value={formatNumber(data.uiErrors.recentErrors, t.locale)} tone={data.uiErrors.recentErrors > 0 ? 'danger' : undefined} />
                    <KeyValueRow label={t('adminOps.health.uiLastError')} value={formatWhen(data.uiErrors.lastErrorDate, t, '—')} />
                </Card>
            </Section>

            <Section title={t('adminOps.health.integrations')} right={<OkPill ok={integrationsOk} />} testID="admin-health-integrations">
                {(['whatsapp', 'telegram'] as const).map((key) => (
                    <StatusCard
                        key={key}
                        title={t(key === 'whatsapp' ? 'adminOps.health.whatsapp' : 'adminOps.health.telegram')}
                        ok={data.integrations[key].ok}
                        icon={key === 'whatsapp' ? 'logo-whatsapp' : 'paper-plane-outline'}
                    >
                        {integrationLines(data.integrations[key], t).map((line, index) => <Note key={index}>{line}</Note>)}
                    </StatusCard>
                ))}
            </Section>

            <Section title={t('adminOps.health.more')}>
                <ListGroup inset>
                    <ListRow icon="pulse-outline" title={t('adminOps.nav.monitoring')} onPress={() => navigation.navigate('AdminMonitoring')} />
                    <ListRow icon="medkit-outline" title={t('adminOps.nav.healthCheck')} onPress={() => navigation.navigate('AdminHealthCheck')} />
                </ListGroup>
            </Section>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    heroIcon: { width: 52, height: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
    heroTitle: { ...typeScale.headline, color: colors.text.primary },
    heroText: { ...typeScale.body, color: colors.text.secondary, marginTop: space.xxs },
    heroMeta: { ...typeScale.caption, color: colors.text.tertiary, marginTop: space.md },
});
