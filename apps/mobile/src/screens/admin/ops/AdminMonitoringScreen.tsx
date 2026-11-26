import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusPill } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import FormField, { FieldRow } from '../../../components/ui/FormField';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { SkeletonCard, SkeletonList } from '../../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import SegmentedTabs from '../../../components/SegmentedTabs';
import { space, typeScale } from '../../../constants/theme';
import { colors } from '../../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { formatNumber } from '../../manage/opsKit/money';
import { Field } from '../../manage/opsKit/ui';
import {
    EMPTY_METRICS_FILTERS,
    fetchApiMetrics,
    fetchFinanceLogs,
    fetchMonitoringStats,
    type LogsFilters,
    type MetricsFilters,
} from './adminOpsApi';
import { formatDuration, httpStatusTone, logLevelTone, ratioPercent, signed } from './adminOpsLogic';
import { AdminError, adminStyles, formatWhen, Note } from './adminOpsUi';

type Tab = 'stats' | 'metrics' | 'logs';

const METHODS = ['', 'GET', 'POST', 'PUT', 'DELETE'] as const;
const ERROR_TYPES: { key: string; label: MobileI18nKey }[] = [
    { key: '', label: 'adminOps.monitoring.all' },
    { key: 'validation', label: 'adminOps.monitoring.errorType.validation' },
    { key: 'database', label: 'adminOps.monitoring.errorType.database' },
    { key: 'auth', label: 'adminOps.monitoring.errorType.auth' },
    { key: 'server', label: 'adminOps.monitoring.errorType.server' },
    { key: 'network', label: 'adminOps.monitoring.errorType.network' },
];
const OPERATIONS: { key: string; label: MobileI18nKey }[] = [
    { key: '', label: 'adminOps.monitoring.all' },
    { key: 'shift_open', label: 'adminOps.monitoring.logs.shiftOpen' },
    { key: 'shift_close', label: 'adminOps.monitoring.logs.shiftClose' },
    { key: 'item_create', label: 'adminOps.monitoring.logs.itemCreate' },
    { key: 'item_update', label: 'adminOps.monitoring.logs.itemUpdate' },
    { key: 'item_delete', label: 'adminOps.monitoring.logs.itemDelete' },
    { key: 'items_save', label: 'adminOps.monitoring.logs.itemsSave' },
    { key: 'error', label: 'adminOps.monitoring.logs.error' },
];
// The levels the finance-logs route accepts (info / warning / error).
const LEVELS: { key: string; label: MobileI18nKey }[] = [
    { key: '', label: 'adminOps.monitoring.all' },
    { key: 'info', label: 'adminOps.monitoring.logs.levelInfo' },
    { key: 'warning', label: 'adminOps.monitoring.logs.levelWarning' },
    { key: 'error', label: 'adminOps.monitoring.logs.levelError' },
];

function StatsTab() {
    const { t } = useLanguage();
    const query = useQuery({ queryKey: ['admin-ops', 'monitoring', 'stats'], queryFn: fetchMonitoringStats });
    if (query.isLoading) return <SkeletonCard lines={4} />;
    if (!query.data) return <AdminError title={t('adminOps.monitoring.error')} error={query.error} onRetry={() => void query.refetch()} />;
    const { stats, authFlow } = query.data;
    return (
        <View style={styles.tab} testID="admin-monitoring-stats">
            <Section title={t('adminOps.monitoring.stats.title')} caption={t('adminOps.monitoring.stats.description')}>
                {stats ? (
                    <>
                        <Text style={adminStyles.mono}>{`${t('adminOps.monitoring.endpoint')}: ${stats.endpoint}`}</Text>
                        <StatGrid>
                            <StatTile label={t('adminOps.monitoring.stats.total')} value={formatNumber(stats.total_requests, t.locale)} />
                            <StatTile label={t('adminOps.monitoring.stats.success')} value={formatNumber(stats.success_count, t.locale)} tone="success" />
                            <StatTile label={t('adminOps.monitoring.stats.errors')} value={formatNumber(stats.client_error_count + stats.server_error_count, t.locale)} tone="danger" />
                            <StatTile label={t('adminOps.monitoring.stats.errorRate')} value={`${stats.error_rate.toFixed(2)}%`} />
                            <StatTile label={t('adminOps.monitoring.stats.avgDuration')} value={formatDuration(stats.avg_duration_ms)} />
                            <StatTile label={t('adminOps.health.p95')} value={formatDuration(stats.p95_duration_ms)} />
                            <StatTile label={t('adminOps.health.p99')} value={formatDuration(stats.p99_duration_ms)} />
                        </StatGrid>
                    </>
                ) : (
                    <EmptyState compact icon="stats-chart-outline" title={t('adminOps.monitoring.stats.emptyTitle')} message={t('adminOps.monitoring.stats.emptyDescription')} />
                )}
            </Section>
            {authFlow ? (
                <Section title={t('adminOps.monitoring.authFlow.title')} caption={t('adminOps.monitoring.authFlow.window', { hours: authFlow.windowHours })} testID="admin-monitoring-auth">
                    <StatGrid columns={3}>
                        <StatTile label={t('adminOps.monitoring.authFlow.started')} value={String(authFlow.current.started)} />
                        <StatTile label={t('adminOps.monitoring.authFlow.approved')} value={String(authFlow.current.approved)} tone="success" />
                        <StatTile label={t('adminOps.monitoring.authFlow.expired')} value={String(authFlow.current.expired)} tone="warning" />
                        <StatTile label={t('adminOps.monitoring.authFlow.failed')} value={String(authFlow.current.failed)} tone="danger" />
                        <StatTile label={t('adminOps.monitoring.authFlow.approvedRate')} value={ratioPercent(authFlow.current.approvedRate)} />
                    </StatGrid>
                    <Note>
                        {t('adminOps.monitoring.authFlow.delta', {
                            value: [
                                `${t('adminOps.monitoring.authFlow.started')} ${signed(authFlow.deltas.started)}`,
                                `${t('adminOps.monitoring.authFlow.approved')} ${signed(authFlow.deltas.approved)}`,
                                `${t('adminOps.monitoring.authFlow.expired')} ${signed(authFlow.deltas.expired)}`,
                                `${t('adminOps.monitoring.authFlow.failed')} ${signed(authFlow.deltas.failed)}`,
                                ...(authFlow.deltas.approvedRate !== null ? [`${t('adminOps.monitoring.authFlow.approvedRate')} ${(authFlow.deltas.approvedRate * 100).toFixed(1)}pp`] : []),
                            ].join(', '),
                        })}
                    </Note>
                </Section>
            ) : null}
        </View>
    );
}

function MetricsTab() {
    const { t } = useLanguage();
    const [draft, setDraft] = useState<MetricsFilters>(EMPTY_METRICS_FILTERS);
    const [applied, setApplied] = useState<MetricsFilters>(EMPTY_METRICS_FILTERS);
    const query = useQuery({ queryKey: ['admin-ops', 'monitoring', 'metrics', applied], queryFn: () => fetchApiMetrics(applied) });
    const set = (patch: Partial<MetricsFilters>) => setDraft((current) => ({ ...current, ...patch }));
    const apply = () => {
        if (JSON.stringify(draft) === JSON.stringify(applied)) void query.refetch();
        else setApplied(draft);
    };

    return (
        <View style={styles.tab} testID="admin-monitoring-metrics">
            <Section title={t('adminOps.monitoring.filters')}>
                <Card variant="plain" padding="md" style={styles.filters}>
                    <FormField
                        label={t('adminOps.monitoring.endpoint')}
                        value={draft.endpoint}
                        onChangeText={(endpoint) => set({ endpoint })}
                        placeholder="/api/staff/finance"
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID="admin-metrics-endpoint"
                    />
                    <Field label={t('adminOps.monitoring.method')}>
                        <ChipGroup
                            options={METHODS.map((method) => ({ key: method, label: method || t('adminOps.monitoring.all') }))}
                            value={draft.method}
                            onChange={(method) => set({ method })}
                            accessibilityLabel={t('adminOps.monitoring.method')}
                        />
                    </Field>
                    <FieldRow>
                        <FormField
                            label={t('adminOps.monitoring.statusCode')}
                            value={draft.statusCode}
                            onChangeText={(statusCode) => set({ statusCode: statusCode.replace(/\D/g, '').slice(0, 3) })}
                            keyboardType="number-pad"
                            placeholder="500"
                            testID="admin-metrics-status"
                        />
                        <FormField
                            label={t('adminOps.monitoring.minDuration')}
                            value={draft.minDuration}
                            onChangeText={(minDuration) => set({ minDuration: minDuration.replace(/\D/g, '') })}
                            keyboardType="number-pad"
                            suffix={t('adminOps.monitoring.ms')}
                            placeholder="1000"
                        />
                    </FieldRow>
                    <Field label={t('adminOps.monitoring.errorType')}>
                        <ChipGroup
                            options={ERROR_TYPES.map((item) => ({ key: item.key, label: t(item.label) }))}
                            value={draft.errorType}
                            onChange={(errorType) => set({ errorType })}
                            accessibilityLabel={t('adminOps.monitoring.errorType')}
                        />
                    </Field>
                    <Button title={t('adminOps.monitoring.apply')} onPress={apply} variant="outline" loading={query.isFetching} fullWidth testID="admin-metrics-apply" />
                </Card>
            </Section>

            {query.isLoading ? (
                <SkeletonList rows={5} avatar={false} />
            ) : query.error && !query.data ? (
                <AdminError title={t('adminOps.monitoring.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState compact icon="search-outline" title={t('adminOps.monitoring.metrics.emptyTitle')} message={t('adminOps.monitoring.metrics.emptyDescription')} />
            ) : (
                <Card variant="plain" padding="md">
                    {(query.data ?? []).map((metric, index) => (
                        <View key={metric.id} testID={`admin-metric-${metric.id}`}>
                            {index > 0 ? <View style={adminStyles.separator} /> : null}
                            <View style={styles.item}>
                                <View style={adminStyles.rowBetween}>
                                    <Text style={[adminStyles.mono, styles.flex, styles.primary]} numberOfLines={2}>{metric.endpoint}</Text>
                                    <StatusPill label={String(metric.status_code)} tone={httpStatusTone(metric.status_code)} />
                                </View>
                                <Text style={adminStyles.rowMeta}>{`${metric.method} · ${formatDuration(metric.duration_ms)} · ${formatWhen(metric.created_at, t)}`}</Text>
                                {metric.error_message || metric.error_type ? (
                                    <Text style={styles.error} numberOfLines={3}>{metric.error_message || metric.error_type}</Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </Card>
            )}
        </View>
    );
}

function LogsTab() {
    const { t } = useLanguage();
    const [filters, setFilters] = useState<LogsFilters>({ operationType: '', logLevel: '' });
    const query = useQuery({ queryKey: ['admin-ops', 'monitoring', 'logs', filters], queryFn: () => fetchFinanceLogs(filters) });
    return (
        <View style={styles.tab} testID="admin-monitoring-logs">
            <Section gap={space.md}>
                <Field label={t('adminOps.monitoring.logs.operationType')}>
                    <ChipGroup
                        options={OPERATIONS.map((item) => ({ key: item.key, label: t(item.label) }))}
                        value={filters.operationType}
                        onChange={(operationType) => setFilters((current) => ({ ...current, operationType }))}
                        accessibilityLabel={t('adminOps.monitoring.logs.operationType')}
                        testID="admin-logs-operation"
                    />
                </Field>
                <Field label={t('adminOps.monitoring.logs.level')}>
                    <ChipGroup
                        options={LEVELS.map((item) => ({ key: item.key, label: t(item.label) }))}
                        value={filters.logLevel}
                        onChange={(logLevel) => setFilters((current) => ({ ...current, logLevel }))}
                        accessibilityLabel={t('adminOps.monitoring.logs.level')}
                        testID="admin-logs-level"
                    />
                </Field>
            </Section>
            {query.isLoading ? (
                <SkeletonList rows={5} avatar={false} />
            ) : query.error && !query.data ? (
                <AdminError title={t('adminOps.monitoring.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState compact icon="document-text-outline" title={t('adminOps.monitoring.logs.emptyTitle')} message={t('adminOps.monitoring.logs.emptyDescription')} />
            ) : (
                <Card variant="plain" padding="md">
                    {(query.data ?? []).map((log, index) => (
                        <View key={log.id}>
                            {index > 0 ? <View style={adminStyles.separator} /> : null}
                            <View style={styles.item}>
                                <View style={adminStyles.rowBetween}>
                                    <Text style={[adminStyles.mono, styles.flex, styles.primary]} numberOfLines={1}>{log.operation_type}</Text>
                                    <StatusPill label={log.log_level} tone={logLevelTone(log.log_level)} />
                                </View>
                                <Text style={styles.message}>{log.message}</Text>
                                <Text style={adminStyles.rowMeta}>
                                    {[formatWhen(log.created_at, t), log.staff?.full_name, log.business?.name].filter(Boolean).join(' · ')}
                                </Text>
                                {log.error_message ? <Text style={styles.error} numberOfLines={4}>{log.error_message}</Text> : null}
                            </View>
                        </View>
                    ))}
                </Card>
            )}
        </View>
    );
}

/** The website's /admin/monitoring: endpoint stats with the Telegram sign-in flow, API metrics and finance operation logs. */
export default function AdminMonitoringScreen() {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('stats');
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
        setRefreshing(true);
        try { await queryClient.refetchQueries({ queryKey: ['admin-ops', 'monitoring'], type: 'active' }); } finally { setRefreshing(false); }
    };
    return (
        <Screen keyboard refreshing={refreshing} onRefresh={onRefresh} testID="admin-monitoring-screen">
            <SegmentedTabs
                tabs={[
                    { key: 'stats', label: t('adminOps.monitoring.tab.stats') },
                    { key: 'metrics', label: t('adminOps.monitoring.tab.metrics') },
                    { key: 'logs', label: t('adminOps.monitoring.tab.logs') },
                ]}
                value={tab}
                onChange={setTab}
                testID="admin-monitoring-tabs"
            />
            {tab === 'stats' ? <StatsTab /> : tab === 'metrics' ? <MetricsTab /> : <LogsTab />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    tab: { gap: space.xxl },
    flex: { flex: 1 },
    filters: { gap: space.lg },
    item: { gap: space.xs, paddingVertical: space.xs },
    primary: { color: colors.text.primary },
    message: { ...typeScale.body, color: colors.text.primary },
    error: { ...typeScale.callout, color: colors.tone.danger.fg },
});
