'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Tabs } from '@/components/ui/Tabs';

type ApiMetric = {
    id: string;
    endpoint: string;
    method: string;
    status_code: number;
    duration_ms: number;
    error_message?: string | null;
    error_type?: string | null;
    user_id?: string | null;
    staff_id?: string | null;
    biz_id?: string | null;
    created_at: string;
};

type FinanceLog = {
    id: string;
    staff_id: string;
    biz_id: string;
    shift_id?: string | null;
    operation_type: string;
    log_level: string;
    message: string;
    error_message?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
    staff?: { id: string; full_name: string } | null;
    business?: { id: string; name: string; slug: string } | null;
};

type MetricsResponse = {
    ok: boolean;
    data: ApiMetric[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    error?: string;
};

type FinanceLogsResponse = {
    ok: boolean;
    data: FinanceLog[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    error?: string;
};

type StatsResponse = {
    ok: boolean;
    data: {
        endpoint: string;
        total_requests: number;
        success_count: number;
        client_error_count: number;
        server_error_count: number;
        avg_duration_ms: number;
        p95_duration_ms: number;
        p99_duration_ms: number;
        error_rate: number;
        error_types?: string[];
        status_codes?: Record<string, number>;
    };
    error?: string;
};

type AuthFlowSnapshot = {
    started: number;
    approved: number;
    expired: number;
    failed: number;
    resolved: number;
    pending: number;
    approvedRate: number | null;
};

type AuthFlowResponse = {
    ok: boolean;
    data: {
        windowHours: number;
        ranges: {
            current: { from: string; to: string };
            previous: { from: string; to: string };
        };
        current: AuthFlowSnapshot;
        previous: AuthFlowSnapshot;
        deltas: {
            started: number;
            approved: number;
            expired: number;
            failed: number;
            approvedRate: number | null;
        };
    };
    error?: string;
};

type Tab = 'metrics' | 'logs' | 'stats';

export default function MonitoringClient() {
    const [activeTab, setActiveTab] = useState<Tab>('stats');
    const [metrics, setMetrics] = useState<ApiMetric[]>([]);
    const [logs, setLogs] = useState<FinanceLog[]>([]);
    const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
    const [authFlow, setAuthFlow] = useState<AuthFlowResponse['data'] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [metricsFilters, setMetricsFilters] = useState({
        endpoint: '',
        method: '',
        statusCode: '',
        errorType: '',
        minDuration: '',
    });

    const [logsFilters, setLogsFilters] = useState({
        operationType: '',
        logLevel: '',
        staffId: '',
        bizId: '',
    });

    const loadMetrics = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (metricsFilters.endpoint) params.set('endpoint', metricsFilters.endpoint);
            if (metricsFilters.method) params.set('method', metricsFilters.method);
            if (metricsFilters.statusCode) params.set('statusCode', metricsFilters.statusCode);
            if (metricsFilters.errorType) params.set('errorType', metricsFilters.errorType);
            if (metricsFilters.minDuration) params.set('minDuration', metricsFilters.minDuration);
            params.set('limit', '50');

            const response = await fetch(`/api/admin/metrics?${params.toString()}`);
            const data: MetricsResponse = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load metrics');
            }

            setMetrics(data.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (logsFilters.operationType) params.set('operationType', logsFilters.operationType);
            if (logsFilters.logLevel) params.set('logLevel', logsFilters.logLevel);
            if (logsFilters.staffId) params.set('staffId', logsFilters.staffId);
            if (logsFilters.bizId) params.set('bizId', logsFilters.bizId);
            params.set('limit', '50');

            const response = await fetch(`/api/admin/finance-logs?${params.toString()}`);
            const data: FinanceLogsResponse = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load logs');
            }

            setLogs(data.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.set('endpoint', '/api/staff/finance');
            params.set('windowMinutes', '60');

            const [response, authFlowResponse] = await Promise.all([
                fetch(`/api/admin/metrics/stats?${params.toString()}`),
                fetch('/api/admin/metrics/auth-flow?windowHours=24'),
            ]);
            const data: StatsResponse = await response.json();
            const authFlowData: AuthFlowResponse = await authFlowResponse.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load stats');
            }
            if (!authFlowData.ok) {
                throw new Error(authFlowData.error || 'Failed to load auth flow stats');
            }

            setStats(data.data);
            setAuthFlow(authFlowData.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'metrics') {
            loadMetrics();
        } else if (activeTab === 'logs') {
            loadLogs();
        } else if (activeTab === 'stats') {
            loadStats();
        }
    }, [activeTab]);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatPercent = (value: number | null) => {
        if (value === null) {
            return '-';
        }

        return `${(value * 100).toFixed(1)}%`;
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeader
                title="Р СљР С•Р Р…Р С‘РЎ‚оринг Р С‘ РВ°РЅРВ°РВ»РёС‚РёРєРВ°"
                description="РњРВµС‚РЎР‚Р С‘Р С”Р С‘ API, РѕРїРВµСЂРВ°СвЂ Р С‘Р С•Р Р…Р Р…РЎвЂ№РВµ РВ»оги Р С‘ РЎРѓР Р†Р С•Р Т‘РєРВ° РїРѕ Р С—РЎР‚Р С•Р С‘Р В·РІРѕРТ‘РёС‚РВµРВ»РЎРЉР Р…Р С•РЎРѓРЎ‚Р С‘ Р С”РЎР‚Р С‘РЎ‚РёС‡РВµРЎРѓР С”Р С‘РЎвЂ¦ СЌРЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚РѕРІ."
                className="mb-6"
            />

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as Tab)}
                items={[
                    { key: 'stats', label: 'РЎС‚РВ°тРёСЃС‚РёРєРВ°' },
                    { key: 'metrics', label: 'РњРВµС‚РЎР‚Р С‘Р С”Р С‘ API' },
                    { key: 'logs', label: 'РвЂєоги РѕРїРВµСЂРВ°СвЂ РёРв„–' },
                ]}
                className="mb-6 w-full max-w-2xl"
                stretch
            />

            {error ? <AlertBanner variant="danger" title="РћСв‚¬РёРВ±РєРВ°" message={error} className="mb-6" /> : null}

            {activeTab === 'stats' ? (
                <div className="space-y-6">
                    <SectionHeader
                        title="Р РЋР Р†Р С•Р Т‘РєРВ° РїРѕ СЌРЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚РЎС“"
                        description="РћРВ±Р Р…Р С•Р Р†Р В»СЏРВµРјРВ°РЎРЏ РєРВ°СЂС‚РёРЅРВ° РїРѕ РЎРѓР С”Р С•РЎР‚Р С•РЎРѓРЎ‚Р С‘, РЎС“РЎРѓР С—Р ВµСв‚¬Р Р…Р С•РЎРѓРЎ‚Р С‘ Р С‘ РЎР‚Р С‘РЎРѓР С”Р В°Р С РВ·РВ° Р С—Р С•РЎРѓР В»РВµРТ‘РЅРёРв„– С‡РВ°РЎРѓ."
                        action={
                            <Button onClick={loadStats} disabled={loading} size="sm">
                                {loading ? 'РвЂ”РВ°Р С–РЎР‚РЎС“Р В·РєРВ°...' : 'РћРВ±Р Р…Р С•Р Р†Р С‘РЎ‚РЎРЉ'}
                            </Button>
                        }
                    />

                    {loading && !stats ? (
                        <StatsSkeleton />
                    ) : stats ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <StatCard title="ВСЃРВµРіРѕ РВ·РВ°просов" value={stats.total_requests} />
                                <StatCard title="Р Р€РЎРѓР С—Р ВµСв‚¬РЅСвЂ№СвЂ¦" value={stats.success_count} valueClassName="text-green-600 dark:text-green-400" />
                                <StatCard title="РћСв‚¬РёРВ±РѕРє" value={stats.client_error_count + stats.server_error_count} valueClassName="text-red-600 dark:text-red-400" />
                                <StatCard title="РЎСЂРВµРТ‘РЅРВµРВµ РІСЂРВµРјСЏ" value={formatDuration(stats.avg_duration_ms)} />
                                <StatCard title="P95" value={formatDuration(stats.p95_duration_ms)} />
                                <StatCard title="P99" value={formatDuration(stats.p99_duration_ms)} />
                                <StatCard title="Р СџРЎР‚Р С•РЎвЂ РВµРЅС‚ РѕСв‚¬РёРВ±РѕРє" value={`${stats.error_rate.toFixed(2)}%`} />
                                <StatCard title="РВ­РЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚" value={stats.endpoint} />
                            </div>

                            {authFlow ? (
                                <Card variant="elevated" padding="lg">
                                    <SectionHeader
                                        title="Telegram Mobile Auth Flow"
                                        description={`Окно мониторинга: последние ${authFlow.windowHours} ч`}
                                        className="mb-4"
                                    />
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                                        <StatCard title="Started" value={authFlow.current.started} />
                                        <StatCard title="Approved" value={authFlow.current.approved} valueClassName="text-green-600 dark:text-green-400" />
                                        <StatCard title="Expired" value={authFlow.current.expired} valueClassName="text-amber-600 dark:text-amber-400" />
                                        <StatCard title="Failed" value={authFlow.current.failed} valueClassName="text-red-600 dark:text-red-400" />
                                        <StatCard title="Approved Rate" value={formatPercent(authFlow.current.approvedRate)} />
                                    </div>
                                    <p className="mt-4 text-sm text-[var(--text-secondary)]">
                                        Δ started: {authFlow.deltas.started >= 0 ? '+' : ''}
                                        {authFlow.deltas.started}, approved: {authFlow.deltas.approved >= 0 ? '+' : ''}
                                        {authFlow.deltas.approved}, expired: {authFlow.deltas.expired >= 0 ? '+' : ''}
                                        {authFlow.deltas.expired}, failed: {authFlow.deltas.failed >= 0 ? '+' : ''}
                                        {authFlow.deltas.failed}
                                        {authFlow.deltas.approvedRate !== null
                                            ? `, approvedRate: ${(authFlow.deltas.approvedRate * 100).toFixed(1)}pp`
                                            : ''}
                                    </p>
                                </Card>
                            ) : null}
                        </div>
                    ) : (
                        <EmptyState compact title="РќРВµт РТ‘РВ°РЅРЅСвЂ№СвЂ¦" description="Р”РВ»РЎРЏ СЌС‚Р С•Р С–Р С• СЌРЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚РВ° Р С—Р С•Р С”Р В° РЅРВµт РЎРѓР Р†Р С•Р Т‘РЅРѕРв„– СЃС‚РВ°тРёСЃС‚Р С‘Р С”Р С‘." />
                    )}
                </div>
            ) : null}

            {activeTab === 'metrics' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="РВ¤РёРВ»СЊС‚СЂСвЂ№ РјРВµС‚РЎР‚Р С‘Р С”" description="РћС‚СЃРВµРв„–С‚РВµ РЅСѓРВ¶РЅСвЂ№РВµ СЌРЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚СвЂ№, РјРВµтРѕРТ‘СвЂ№, РѕСв‚¬РёРВ±РєРё Р С‘ РјРВµРТ‘РВ»РВµРЅРЅСвЂ№РВµ РВ·РВ°Р С—РЎР‚Р С•РЎРѓРЎвЂ№." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <FilterField label="РВ­РЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚">
                                <input
                                    type="text"
                                    value={metricsFilters.endpoint}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, endpoint: e.target.value })}
                                    placeholder="/api/staff/finance"
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="РњРВµтРѕРТ‘">
                                <select
                                    value={metricsFilters.method}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, method: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">ВСЃРВµ</option>
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </FilterField>
                            <FilterField label="РЎС‚РВ°тСѓСЃ РєРѕРТ‘">
                                <input
                                    type="number"
                                    value={metricsFilters.statusCode}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, statusCode: e.target.value })}
                                    placeholder="200, 400, 500..."
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="Тип РѕСв‚¬РёРВ±РєРё">
                                <select
                                    value={metricsFilters.errorType}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, errorType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">ВСЃРВµ</option>
                                    <option value="validation">Validation</option>
                                    <option value="database">Database</option>
                                    <option value="auth">Auth</option>
                                    <option value="server">Server</option>
                                    <option value="network">Network</option>
                                </select>
                            </FilterField>
                            <FilterField label="Мин. РІСЂРВµРјя (Рјс)">
                                <input
                                    type="number"
                                    value={metricsFilters.minDuration}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, minDuration: e.target.value })}
                                    placeholder="1000"
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                        </div>
                        <div className="mt-4">
                            <Button onClick={loadMetrics} disabled={loading}>
                                {loading ? 'РвЂ”РВ°Р С–РЎР‚РЎС“Р В·РєРВ°...' : 'Р СџРЎР‚Р С‘Р СР ВµнитСЊ СвЂћРёРВ»СЊС‚СЂСвЂ№'}
                            </Button>
                        </div>
                    </Card>

                    {loading && metrics.length === 0 ? (
                        <TableSkeleton />
                    ) : metrics.length > 0 ? (
                        <Card variant="elevated" padding="none" className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <TableHead>ВСЂРВµРјя</TableHead>
                                        <TableHead>РВ­РЅРТ‘Р С—Р С•Р С‘Р Р…РЎ‚</TableHead>
                                        <TableHead>РњРВµтРѕРТ‘</TableHead>
                                        <TableHead>РЎС‚РВ°тСѓСЃ</TableHead>
                                        <TableHead>ВСЂРВµРјя</TableHead>
                                        <TableHead>РћСв‚¬РёРВ±РєРВ°</TableHead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map((metric) => (
                                        <tr key={metric.id} className="border-t border-gray-200 dark:border-gray-700">
                                            <TableCell>{new Date(metric.created_at).toLocaleString('ru-RU')}</TableCell>
                                            <TableCell className="font-mono text-sm">{metric.endpoint}</TableCell>
                                            <TableCell>{metric.method}</TableCell>
                                            <TableCell>
                                                <StatusChip
                                                    status={
                                                        metric.status_code >= 500
                                                            ? 'error'
                                                            : metric.status_code >= 400
                                                              ? 'warning'
                                                              : 'success'
                                                    }
                                                    label={String(metric.status_code)}
                                                />
                                            </TableCell>
                                            <TableCell>{formatDuration(metric.duration_ms)}</TableCell>
                                            <TableCell className="text-sm text-red-600 dark:text-red-400">{metric.error_message || metric.error_type || '-'}</TableCell>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    ) : (
                        <EmptyState compact title="РќРВµт РјРВµС‚РЎР‚Р С‘Р С”" description="РВ¤РёРВ»СЊС‚СЂСвЂ№ РЅРВµ РІРВµРЎР‚Р Р…РЎС“Р В»Р С‘ РТ‘РВ°РЅРЅСвЂ№СвЂ¦. Р СџР С•Р С—РЎР‚Р С•Р В±СѓРв„–С‚РВµ РёРВ·РјРВµнитСЊ СѓСЃРВ»овия РІСвЂ№РВ±орки." />
                    )}
                </div>
            ) : null}

            {activeTab === 'logs' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="РВ¤РёРВ»СЊС‚СЂСвЂ№ РВ»огов" description="РћСЃС‚РВ°РІСЊС‚РВµ РЅСѓРВ¶РЅСвЂ№Рв„– тРёРї РѕРїРВµСЂРВ°СвЂ РёРё Р С‘ РЎС“РЎР‚Р С•Р Р†Р ВµРЅСЊ РВ¶РЎС“РЎР‚Р Р…Р В°РВ»РВ°." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FilterField label="Тип РѕРїРВµСЂРВ°СвЂ РёРё">
                                <select
                                    value={logsFilters.operationType}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, operationType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">ВСЃРВµ</option>
                                    <option value="shift_open">РћС‚РєСЂСвЂ№тРёРВµ СЃРјРВµРЅСвЂ№</option>
                                    <option value="shift_close">РвЂ”РВ°РєСЂСвЂ№тРёРВµ СЃРјРВµРЅСвЂ№</option>
                                    <option value="item_create">РЎРѕРВ·РТ‘РВ°РЅРёРВµ РєРВ»РёРВµРЅС‚РВ°</option>
                                    <option value="item_update">РћРВ±Р Р…Р С•Р Р†Р В»РВµРЅРёРВµ РєРВ»РёРВµРЅС‚РВ°</option>
                                    <option value="item_delete">РЈРТ‘РВ°РВ»РВµРЅРёРВµ РєРВ»РёРВµРЅС‚РВ°</option>
                                    <option value="items_save">РЎРѕСвЂ¦СЂРВ°РЅРВµРЅРёРВµ РЎРѓР С—Р С‘РЎРѓР С”Р В°</option>
                                    <option value="error">РћСв‚¬РёРВ±РєРВ°</option>
                                </select>
                            </FilterField>
                            <FilterField label="Р Р€РЎР‚Р С•Р Р†Р ВµРЅСЊ">
                                <select
                                    value={logsFilters.logLevel}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, logLevel: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">ВСЃРВµ</option>
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warn</option>
                                    <option value="error">Error</option>
                                </select>
                            </FilterField>
                        </div>
                        <div className="mt-4">
                            <Button onClick={loadLogs} disabled={loading}>
                                {loading ? 'РвЂ”РВ°Р С–РЎР‚РЎС“Р В·РєРВ°...' : 'Р СџРЎР‚Р С‘Р СР ВµнитСЊ СвЂћРёРВ»СЊС‚СЂСвЂ№'}
                            </Button>
                        </div>
                    </Card>

                    {loading && logs.length === 0 ? (
                        <TableSkeleton />
                    ) : logs.length > 0 ? (
                        <Card variant="elevated" padding="none" className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <TableHead>ВСЂРВµРјя</TableHead>
                                        <TableHead>Тип</TableHead>
                                        <TableHead>Р Р€РЎР‚Р С•Р Р†Р ВµРЅСЊ</TableHead>
                                        <TableHead>РЎРѕС‚СЂСѓРТ‘ник</TableHead>
                                        <TableHead>Р РЋР С•Р С•Р В±СвЂ°РВµРЅРёРВµ</TableHead>
                                        <TableHead>РћСв‚¬РёРВ±РєРВ°</TableHead>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-t border-gray-200 dark:border-gray-700">
                                            <TableCell>{new Date(log.created_at).toLocaleString('ru-RU')}</TableCell>
                                            <TableCell>{log.operation_type}</TableCell>
                                            <TableCell>
                                                <StatusChip
                                                    status={log.log_level === 'error' ? 'error' : log.log_level === 'warn' ? 'warning' : log.log_level}
                                                    label={log.log_level}
                                                />
                                            </TableCell>
                                            <TableCell>{log.staff?.full_name || '-'}</TableCell>
                                            <TableCell className="text-sm">{log.message}</TableCell>
                                            <TableCell className="text-sm text-red-600 dark:text-red-400">{log.error_message || '-'}</TableCell>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    ) : (
                        <EmptyState compact title="РќРВµт РВ»огов" description="РџРѕ С‚РВµРєСѓСвЂ°РВµРв„– РІСвЂ№РВ±Р С•РЎР‚Р С”Р Вµ РѕРїРВµСЂРВ°СвЂ Р С‘Р С•Р Р…Р Р…РЎвЂ№Рв„– РВ¶РЎС“РЎР‚Р Р…Р В°РВ» Р С—РЎС“РЎРѓРЎ‚." />
                    )}
                </div>
            ) : null}
        </div>
    );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
            {children}
        </div>
    );
}

function TableHead({ children }: { children: React.ReactNode }) {
    return <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">{children}</th>;
}

function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-4 py-2 text-sm text-gray-900 dark:text-gray-100 ${className}`}>{children}</td>;
}

function StatCard({
    title,
    value,
    valueClassName = '',
}: {
    title: string;
    value: string | number;
    valueClassName?: string;
}) {
    return (
        <Card variant="elevated" padding="md">
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className={`mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 ${valueClassName}`}>{value}</p>
        </Card>
    );
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} variant="elevated" padding="md">
                    <Skeleton className="mb-3 h-4 w-24" />
                    <SkeletonText lines={2} />
                </Card>
            ))}
        </div>
    );
}

function TableSkeleton() {
    return (
        <Card variant="elevated" padding="lg">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </div>
        </Card>
    );
}


