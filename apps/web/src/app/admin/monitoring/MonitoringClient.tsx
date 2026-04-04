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

type Tab = 'metrics' | 'logs' | 'stats';

export default function MonitoringClient() {
    const [activeTab, setActiveTab] = useState<Tab>('stats');
    const [metrics, setMetrics] = useState<ApiMetric[]>([]);
    const [logs, setLogs] = useState<FinanceLog[]>([]);
    const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
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

            const response = await fetch(`/api/admin/metrics/stats?${params.toString()}`);
            const data: StatsResponse = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load stats');
            }

            setStats(data.data);
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

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeader
                title="РњРѕРЅРёС‚РѕСЂРёРЅРі Рё Р°РЅР°Р»РёС‚РёРєР°"
                description="РњРµС‚СЂРёРєРё API, РѕРїРµСЂР°С†РёРѕРЅРЅС‹Рµ Р»РѕРіРё Рё СЃРІРѕРґРєР° РїРѕ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё РєСЂРёС‚РёС‡РµСЃРєРёС… СЌРЅРґРїРѕРёРЅС‚РѕРІ."
                className="mb-6"
            />

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as Tab)}
                items={[
                    { key: 'stats', label: 'РЎС‚Р°С‚РёСЃС‚РёРєР°' },
                    { key: 'metrics', label: 'РњРµС‚СЂРёРєРё API' },
                    { key: 'logs', label: 'Р›РѕРіРё РѕРїРµСЂР°С†РёР№' },
                ]}
                className="mb-6 w-full max-w-2xl"
                stretch
            />

            {error ? <AlertBanner variant="danger" title="РћС€РёР±РєР°" message={error} className="mb-6" /> : null}

            {activeTab === 'stats' ? (
                <div className="space-y-6">
                    <SectionHeader
                        title="РЎРІРѕРґРєР° РїРѕ СЌРЅРґРїРѕРёРЅС‚Сѓ"
                        description="РћР±РЅРѕРІР»СЏРµРјР°СЏ РєР°СЂС‚РёРЅР° РїРѕ СЃРєРѕСЂРѕСЃС‚Рё, СѓСЃРїРµС€РЅРѕСЃС‚Рё Рё СЂРёСЃРєР°Рј Р·Р° РїРѕСЃР»РµРґРЅРёР№ С‡Р°СЃ."
                        action={
                            <Button onClick={loadStats} disabled={loading} size="sm">
                                {loading ? 'Р—Р°РіСЂСѓР·РєР°...' : 'РћР±РЅРѕРІРёС‚СЊ'}
                            </Button>
                        }
                    />

                    {loading && !stats ? (
                        <StatsSkeleton />
                    ) : stats ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Р’СЃРµРіРѕ Р·Р°РїСЂРѕСЃРѕРІ" value={stats.total_requests} />
                            <StatCard title="РЈСЃРїРµС€РЅС‹С…" value={stats.success_count} valueClassName="text-green-600 dark:text-green-400" />
                            <StatCard title="РћС€РёР±РѕРє" value={stats.client_error_count + stats.server_error_count} valueClassName="text-red-600 dark:text-red-400" />
                            <StatCard title="РЎСЂРµРґРЅРµРµ РІСЂРµРјСЏ" value={formatDuration(stats.avg_duration_ms)} />
                            <StatCard title="P95" value={formatDuration(stats.p95_duration_ms)} />
                            <StatCard title="P99" value={formatDuration(stats.p99_duration_ms)} />
                            <StatCard title="РџСЂРѕС†РµРЅС‚ РѕС€РёР±РѕРє" value={`${stats.error_rate.toFixed(2)}%`} />
                            <StatCard title="Р­РЅРґРїРѕРёРЅС‚" value={stats.endpoint} />
                        </div>
                    ) : (
                        <EmptyState compact title="РќРµС‚ РґР°РЅРЅС‹С…" description="Р”Р»СЏ СЌС‚РѕРіРѕ СЌРЅРґРїРѕРёРЅС‚Р° РїРѕРєР° РЅРµС‚ СЃРІРѕРґРЅРѕР№ СЃС‚Р°С‚РёСЃС‚РёРєРё." />
                    )}
                </div>
            ) : null}

            {activeTab === 'metrics' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="Р¤РёР»СЊС‚СЂС‹ РјРµС‚СЂРёРє" description="РћС‚СЃРµР№С‚Рµ РЅСѓР¶РЅС‹Рµ СЌРЅРґРїРѕРёРЅС‚С‹, РјРµС‚РѕРґС‹, РѕС€РёР±РєРё Рё РјРµРґР»РµРЅРЅС‹Рµ Р·Р°РїСЂРѕСЃС‹." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <FilterField label="Р­РЅРґРїРѕРёРЅС‚">
                                <input
                                    type="text"
                                    value={metricsFilters.endpoint}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, endpoint: e.target.value })}
                                    placeholder="/api/staff/finance"
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="РњРµС‚РѕРґ">
                                <select
                                    value={metricsFilters.method}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, method: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р’СЃРµ</option>
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </FilterField>
                            <FilterField label="РЎС‚Р°С‚СѓСЃ РєРѕРґ">
                                <input
                                    type="number"
                                    value={metricsFilters.statusCode}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, statusCode: e.target.value })}
                                    placeholder="200, 400, 500..."
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                />
                            </FilterField>
                            <FilterField label="РўРёРї РѕС€РёР±РєРё">
                                <select
                                    value={metricsFilters.errorType}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, errorType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р’СЃРµ</option>
                                    <option value="validation">Validation</option>
                                    <option value="database">Database</option>
                                    <option value="auth">Auth</option>
                                    <option value="server">Server</option>
                                    <option value="network">Network</option>
                                </select>
                            </FilterField>
                            <FilterField label="РњРёРЅ. РІСЂРµРјСЏ (РјСЃ)">
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
                                {loading ? 'Р—Р°РіСЂСѓР·РєР°...' : 'РџСЂРёРјРµРЅРёС‚СЊ С„РёР»СЊС‚СЂС‹'}
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
                                        <TableHead>Р’СЂРµРјСЏ</TableHead>
                                        <TableHead>Р­РЅРґРїРѕРёРЅС‚</TableHead>
                                        <TableHead>РњРµС‚РѕРґ</TableHead>
                                        <TableHead>РЎС‚Р°С‚СѓСЃ</TableHead>
                                        <TableHead>Р’СЂРµРјСЏ</TableHead>
                                        <TableHead>РћС€РёР±РєР°</TableHead>
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
                        <EmptyState compact title="РќРµС‚ РјРµС‚СЂРёРє" description="Р¤РёР»СЊС‚СЂС‹ РЅРµ РІРµСЂРЅСѓР»Рё РґР°РЅРЅС‹С…. РџРѕРїСЂРѕР±СѓР№С‚Рµ РёР·РјРµРЅРёС‚СЊ СѓСЃР»РѕРІРёСЏ РІС‹Р±РѕСЂРєРё." />
                    )}
                </div>
            ) : null}

            {activeTab === 'logs' ? (
                <div className="space-y-6">
                    <Card variant="elevated" padding="lg">
                        <SectionHeader title="Р¤РёР»СЊС‚СЂС‹ Р»РѕРіРѕРІ" description="РћСЃС‚Р°РІСЊС‚Рµ РЅСѓР¶РЅС‹Р№ С‚РёРї РѕРїРµСЂР°С†РёРё Рё СѓСЂРѕРІРµРЅСЊ Р¶СѓСЂРЅР°Р»Р°." className="mb-4" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FilterField label="РўРёРї РѕРїРµСЂР°С†РёРё">
                                <select
                                    value={logsFilters.operationType}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, operationType: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р’СЃРµ</option>
                                    <option value="shift_open">РћС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹</option>
                                    <option value="shift_close">Р—Р°РєСЂС‹С‚РёРµ СЃРјРµРЅС‹</option>
                                    <option value="item_create">РЎРѕР·РґР°РЅРёРµ РєР»РёРµРЅС‚Р°</option>
                                    <option value="item_update">РћР±РЅРѕРІР»РµРЅРёРµ РєР»РёРµРЅС‚Р°</option>
                                    <option value="item_delete">РЈРґР°Р»РµРЅРёРµ РєР»РёРµРЅС‚Р°</option>
                                    <option value="items_save">РЎРѕС…СЂР°РЅРµРЅРёРµ СЃРїРёСЃРєР°</option>
                                    <option value="error">РћС€РёР±РєР°</option>
                                </select>
                            </FilterField>
                            <FilterField label="РЈСЂРѕРІРµРЅСЊ">
                                <select
                                    value={logsFilters.logLevel}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, logLevel: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--focus-ring)] focus:outline-none"
                                >
                                    <option value="">Р’СЃРµ</option>
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warn</option>
                                    <option value="error">Error</option>
                                </select>
                            </FilterField>
                        </div>
                        <div className="mt-4">
                            <Button onClick={loadLogs} disabled={loading}>
                                {loading ? 'Р—Р°РіСЂСѓР·РєР°...' : 'РџСЂРёРјРµРЅРёС‚СЊ С„РёР»СЊС‚СЂС‹'}
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
                                        <TableHead>Р’СЂРµРјСЏ</TableHead>
                                        <TableHead>РўРёРї</TableHead>
                                        <TableHead>РЈСЂРѕРІРµРЅСЊ</TableHead>
                                        <TableHead>РЎРѕС‚СЂСѓРґРЅРёРє</TableHead>
                                        <TableHead>РЎРѕРѕР±С‰РµРЅРёРµ</TableHead>
                                        <TableHead>РћС€РёР±РєР°</TableHead>
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
                        <EmptyState compact title="РќРµС‚ Р»РѕРіРѕРІ" description="РџРѕ С‚РµРєСѓС‰РµР№ РІС‹Р±РѕСЂРєРµ РѕРїРµСЂР°С†РёРѕРЅРЅС‹Р№ Р¶СѓСЂРЅР°Р» РїСѓСЃС‚." />
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
