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
                title="Р СљР С•Р Р…Р С‘РЎвЂљР С•РЎР‚Р С‘Р Р…Р С– Р С‘ Р В°Р Р…Р В°Р В»Р С‘РЎвЂљР С‘Р С”Р В°"
                description="Р СљР ВµРЎвЂљРЎР‚Р С‘Р С”Р С‘ API, Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С•Р Р…Р Р…РЎвЂ№Р Вµ Р В»Р С•Р С–Р С‘ Р С‘ РЎРѓР Р†Р С•Р Т‘Р С”Р В° Р С—Р С• Р С—РЎР‚Р С•Р С‘Р В·Р Р†Р С•Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р С•РЎРѓРЎвЂљР С‘ Р С”РЎР‚Р С‘РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘РЎвЂ¦ РЎРЊР Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљР С•Р Р†."
                className="mb-6"
            />

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as Tab)}
                items={[
                    { key: 'stats', label: 'Р РЋРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р В°' },
                    { key: 'metrics', label: 'Р СљР ВµРЎвЂљРЎР‚Р С‘Р С”Р С‘ API' },
                    { key: 'logs', label: 'Р вЂєР С•Р С–Р С‘ Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р в„–' },
                ]}
                className="mb-6 w-full max-w-2xl"
                stretch
            />

            {error ? <AlertBanner variant="danger" title="Р С›РЎв‚¬Р С‘Р В±Р С”Р В°" message={error} className="mb-6" /> : null}

            {activeTab === 'stats' ? (
                <div className="space-y-6">
                    <SectionHeader
                        title="Р РЋР Р†Р С•Р Т‘Р С”Р В° Р С—Р С• РЎРЊР Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљРЎС“"
                        description="Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР СР В°РЎРЏ Р С”Р В°РЎР‚РЎвЂљР С‘Р Р…Р В° Р С—Р С• РЎРѓР С”Р С•РЎР‚Р С•РЎРѓРЎвЂљР С‘, РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•РЎРѓРЎвЂљР С‘ Р С‘ РЎР‚Р С‘РЎРѓР С”Р В°Р С Р В·Р В° Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р С‘Р в„– РЎвЂЎР В°РЎРѓ."
                        action={
                            <Button onClick={loadStats} disabled={loading} size="sm">
                                {loading ? 'Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...' : 'Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'}
                            </Button>
                        }
                    />

                    {loading && !stats ? (
                        <StatsSkeleton />
                    ) : stats ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <StatCard title="Р вЂ™РЎРѓР ВµР С–Р С• Р В·Р В°Р С—РЎР‚Р С•РЎРѓР С•Р Р†" value={stats.total_requests} />
                                <StatCard title="Р Р€РЎРѓР С—Р ВµРЎв‚¬Р Р…РЎвЂ№РЎвЂ¦" value={stats.success_count} valueClassName="text-green-600 dark:text-green-400" />
                                <StatCard title="Р С›РЎв‚¬Р С‘Р В±Р С•Р С”" value={stats.client_error_count + stats.server_error_count} valueClassName="text-red-600 dark:text-red-400" />
                                <StatCard title="Р РЋРЎР‚Р ВµР Т‘Р Р…Р ВµР Вµ Р Р†РЎР‚Р ВµР СРЎРЏ" value={formatDuration(stats.avg_duration_ms)} />
                                <StatCard title="P95" value={formatDuration(stats.p95_duration_ms)} />
                                <StatCard title="P99" value={formatDuration(stats.p99_duration_ms)} />
                                <StatCard title="Р СџРЎР‚Р С•РЎвЂ Р ВµР Р…РЎвЂљ Р С•РЎв‚¬Р С‘Р В±Р С•Р С”" value={`${stats.error_rate.toFixed(2)}%`} />
                                <StatCard title="Р В­Р Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљ" value={stats.endpoint} />
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
                        <EmptyState compact title="Р СњР ВµРЎвЂљ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦" description="Р вЂќР В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• РЎРЊР Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљР В° Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ РЎРѓР Р†Р С•Р Т‘Р Р…Р С•Р в„– РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘." />
                    )}
                </div>
            ) : null}

            {activeTab === 'metrics' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="Р В¤Р С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№ Р СР ВµРЎвЂљРЎР‚Р С‘Р С”" description="Р С›РЎвЂљРЎРѓР ВµР в„–РЎвЂљР Вµ Р Р…РЎС“Р В¶Р Р…РЎвЂ№Р Вµ РЎРЊР Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљРЎвЂ№, Р СР ВµРЎвЂљР С•Р Т‘РЎвЂ№, Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘ Р С‘ Р СР ВµР Т‘Р В»Р ВµР Р…Р Р…РЎвЂ№Р Вµ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <FilterField label="Р В­Р Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљ">
                                <input
                                    type="text"
                                    value={metricsFilters.endpoint}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, endpoint: e.target.value })}
                                    placeholder="/api/staff/finance"
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="Р СљР ВµРЎвЂљР С•Р Т‘">
                                <select
                                    value={metricsFilters.method}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, method: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р вЂ™РЎРѓР Вµ</option>
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </FilterField>
                            <FilterField label="Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р С”Р С•Р Т‘">
                                <input
                                    type="number"
                                    value={metricsFilters.statusCode}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, statusCode: e.target.value })}
                                    placeholder="200, 400, 500..."
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="Р СћР С‘Р С— Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘">
                                <select
                                    value={metricsFilters.errorType}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, errorType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р вЂ™РЎРѓР Вµ</option>
                                    <option value="validation">Validation</option>
                                    <option value="database">Database</option>
                                    <option value="auth">Auth</option>
                                    <option value="server">Server</option>
                                    <option value="network">Network</option>
                                </select>
                            </FilterField>
                            <FilterField label="Р СљР С‘Р Р…. Р Р†РЎР‚Р ВµР СРЎРЏ (Р СРЎРѓ)">
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
                                {loading ? 'Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...' : 'Р СџРЎР‚Р С‘Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№'}
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
                                        <TableHead>Р вЂ™РЎР‚Р ВµР СРЎРЏ</TableHead>
                                        <TableHead>Р В­Р Р…Р Т‘Р С—Р С•Р С‘Р Р…РЎвЂљ</TableHead>
                                        <TableHead>Р СљР ВµРЎвЂљР С•Р Т‘</TableHead>
                                        <TableHead>Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ</TableHead>
                                        <TableHead>Р вЂ™РЎР‚Р ВµР СРЎРЏ</TableHead>
                                        <TableHead>Р С›РЎв‚¬Р С‘Р В±Р С”Р В°</TableHead>
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
                        <EmptyState compact title="Р СњР ВµРЎвЂљ Р СР ВµРЎвЂљРЎР‚Р С‘Р С”" description="Р В¤Р С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№ Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В»Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦. Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р в„–РЎвЂљР Вµ Р С‘Р В·Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ РЎС“РЎРѓР В»Р С•Р Р†Р С‘РЎРЏ Р Р†РЎвЂ№Р В±Р С•РЎР‚Р С”Р С‘." />
                    )}
                </div>
            ) : null}

            {activeTab === 'logs' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="Р В¤Р С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№ Р В»Р С•Р С–Р С•Р Р†" description="Р С›РЎРѓРЎвЂљР В°Р Р†РЎРЉРЎвЂљР Вµ Р Р…РЎС“Р В¶Р Р…РЎвЂ№Р в„– РЎвЂљР С‘Р С— Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘ Р С‘ РЎС“РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ Р В¶РЎС“РЎР‚Р Р…Р В°Р В»Р В°." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FilterField label="Р СћР С‘Р С— Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘">
                                <select
                                    value={logsFilters.operationType}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, operationType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р вЂ™РЎРѓР Вµ</option>
                                    <option value="shift_open">Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ РЎРѓР СР ВµР Р…РЎвЂ№</option>
                                    <option value="shift_close">Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ РЎРѓР СР ВµР Р…РЎвЂ№</option>
                                    <option value="item_create">Р РЋР С•Р В·Р Т‘Р В°Р Р…Р С‘Р Вµ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР В°</option>
                                    <option value="item_update">Р С›Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР В°</option>
                                    <option value="item_delete">Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР В°</option>
                                    <option value="items_save">Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ РЎРѓР С—Р С‘РЎРѓР С”Р В°</option>
                                    <option value="error">Р С›РЎв‚¬Р С‘Р В±Р С”Р В°</option>
                                </select>
                            </FilterField>
                            <FilterField label="Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ">
                                <select
                                    value={logsFilters.logLevel}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, logLevel: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р вЂ™РЎРѓР Вµ</option>
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warn</option>
                                    <option value="error">Error</option>
                                </select>
                            </FilterField>
                        </div>
                        <div className="mt-4">
                            <Button onClick={loadLogs} disabled={loading}>
                                {loading ? 'Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...' : 'Р СџРЎР‚Р С‘Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№'}
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
                                        <TableHead>Р вЂ™РЎР‚Р ВµР СРЎРЏ</TableHead>
                                        <TableHead>Р СћР С‘Р С—</TableHead>
                                        <TableHead>Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ</TableHead>
                                        <TableHead>Р РЋР С•РЎвЂљРЎР‚РЎС“Р Т‘Р Р…Р С‘Р С”</TableHead>
                                        <TableHead>Р РЋР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ</TableHead>
                                        <TableHead>Р С›РЎв‚¬Р С‘Р В±Р С”Р В°</TableHead>
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
                        <EmptyState compact title="Р СњР ВµРЎвЂљ Р В»Р С•Р С–Р С•Р Р†" description="Р СџР С• РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР в„– Р Р†РЎвЂ№Р В±Р С•РЎР‚Р С”Р Вµ Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С•Р Р…Р Р…РЎвЂ№Р в„– Р В¶РЎС“РЎР‚Р Р…Р В°Р В» Р С—РЎС“РЎРѓРЎвЂљ." />
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

