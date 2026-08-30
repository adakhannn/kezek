'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime } from '@/lib/dateFormat';

type SystemHealthData = {
    ok: boolean;
    timestamp: string;
    cronJobs: {
        shifts: {
            ok: boolean;
            openShiftsOlderThan2Days: number;
            lastCheckDate: string;
        };
        ratings: {
            ok: boolean;
            staffLastMetricDate: string | null;
            branchLastMetricDate: string | null;
            bizLastMetricDate: string | null;
            daysSinceLastMetric: number | null;
        };
    };
    apiMetrics: {
        ok: boolean;
        totalRequests: number;
        errorRate: number;
        avgDuration: number;
        p95Duration: number;
        p99Duration: number;
        recentErrors: number;
    };
    uiErrors: {
        ok: boolean;
        recentErrors: number;
        lastErrorDate: string | null;
    };
    integrations: {
        whatsapp: {
            ok: boolean;
            configured: boolean;
            providerReachable: boolean;
            providerMessage?: string;
            lastSuccessDate: string | null;
            recentFailures: number;
        };
        telegram: {
            ok: boolean;
            configured: boolean;
            providerReachable: boolean;
            providerMessage?: string;
            lastSuccessDate: string | null;
            recentFailures: number;
        };
    };
};

type SystemHealthResponse = {
    ok: boolean;
    data: SystemHealthData;
    error?: string;
};

export default function SystemHealthClient() {
    const [data, setData] = useState<SystemHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const loadHealth = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/admin/system-health', {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result: SystemHealthResponse = await response.json();

            if (!result.ok || !result.data) {
                throw new Error(result.error || 'Failed to load system health');
            }

            setData(result.data);
            setLastUpdate(new Date());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHealth();
        const interval = setInterval(loadHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return formatDateTime(dateStr, 'ru', true);
    };

    if (loading && !data) {
        return (
            <div className="container mx-auto space-y-6 px-4 py-8">
                <Skeleton className="h-10 w-72" />
                <div className="grid gap-6 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Card key={index} variant="elevated" padding="lg">
                            <Skeleton className="mb-3 h-5 w-40" />
                            <SkeletonText lines={4} />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <AlertBanner
                    variant="danger"
                    title="Ошибка загрузки"
                    message={error}
                    action={
                        <Button onClick={loadHealth} variant="danger" size="sm">
                            Попробовать снова
                        </Button>
                    }
                />
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <div className="container mx-auto space-y-6 px-4 py-8">
            <PageHeader
                title="Здоровье системы"
                description="Агрегированная панель мониторинга состояния системы."
                meta={
                    lastUpdate ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Обновлено: {formatDateTime(lastUpdate.toISOString(), 'ru', true)}
                        </span>
                    ) : null
                }
                actions={
                    <Button onClick={loadHealth} disabled={loading} size="sm">
                        <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{loading ? 'Обновление...' : 'Обновить'}</span>
                    </Button>
                }
            />

            <AlertBanner
                variant={data.ok ? 'success' : 'danger'}
                title="Общий статус системы"
                message={
                    data.ok
                        ? 'Все компоненты работают нормально.'
                        : 'Обнаружены проблемы в одном или нескольких компонентах.'
                }
                action={<StatusChip status={data.ok ? 'ok' : 'error'} label={data.ok ? 'OK' : 'Проблема'} />}
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card variant="elevated" padding="lg">
                    <SectionHeader
                        title="Cron-задачи"
                        action={<StatusChip status={data.cronJobs.shifts.ok && data.cronJobs.ratings.ok ? 'ok' : 'error'} label={data.cronJobs.shifts.ok && data.cronJobs.ratings.ok ? 'OK' : 'Проблема'} />}
                        className="mb-4"
                    />
                    <div className="space-y-4">
                        <HealthPanel
                            title="Закрытие смен"
                            ok={data.cronJobs.shifts.ok}
                            lines={[
                                `Незакрытых смен старше 2 дней: ${data.cronJobs.shifts.openShiftsOlderThan2Days}`,
                                `Последняя проверка: ${data.cronJobs.shifts.lastCheckDate}`,
                            ]}
                        />
                        <HealthPanel
                            title="Пересчет рейтингов"
                            ok={data.cronJobs.ratings.ok}
                            lines={[
                                data.cronJobs.ratings.daysSinceLastMetric !== null
                                    ? `Последний пересчет: ${data.cronJobs.ratings.daysSinceLastMetric} дн. назад`
                                    : 'Рейтинги никогда не пересчитывались',
                                `Staff: ${formatDate(data.cronJobs.ratings.staffLastMetricDate)}`,
                                `Branch: ${formatDate(data.cronJobs.ratings.branchLastMetricDate)}`,
                                `Biz: ${formatDate(data.cronJobs.ratings.bizLastMetricDate)}`,
                            ]}
                        />
                    </div>
                </Card>

                <Card variant="elevated" padding="lg">
                    <SectionHeader
                        title="API-метрики"
                        action={<StatusChip status={data.apiMetrics.ok ? 'ok' : 'error'} label={data.apiMetrics.ok ? 'OK' : 'Проблема'} />}
                        className="mb-4"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <MetricBlock label="Всего запросов (1ч)" value={data.apiMetrics.totalRequests} />
                        <MetricBlock label="Процент ошибок" value={`${data.apiMetrics.errorRate.toFixed(2)}%`} />
                        <MetricBlock label="Среднее время" value={formatDuration(data.apiMetrics.avgDuration)} />
                        <MetricBlock label="P95" value={formatDuration(data.apiMetrics.p95Duration)} />
                        <MetricBlock label="P99" value={formatDuration(data.apiMetrics.p99Duration)} />
                        <MetricBlock label="Ошибок (1ч)" value={data.apiMetrics.recentErrors} highlight={data.apiMetrics.recentErrors > 0} />
                    </div>
                </Card>

                <Card variant="elevated" padding="lg">
                    <SectionHeader
                        title="Ошибки UI"
                        action={<StatusChip status={data.uiErrors.ok ? 'ok' : 'error'} label={data.uiErrors.ok ? 'OK' : 'Проблема'} />}
                        className="mb-4"
                    />
                    <div className="space-y-3">
                        <MetricBlock label="Ошибок за последние 24ч" value={data.uiErrors.recentErrors} highlight={data.uiErrors.recentErrors > 0} />
                        <MetricBlock label="Последняя ошибка" value={formatDate(data.uiErrors.lastErrorDate)} />
                    </div>
                </Card>

                <Card variant="elevated" padding="lg">
                    <SectionHeader
                        title="Интеграции"
                        action={
                            <StatusChip
                                status={data.integrations.whatsapp.ok && data.integrations.telegram.ok ? 'ok' : 'error'}
                                label={data.integrations.whatsapp.ok && data.integrations.telegram.ok ? 'OK' : 'Проблема'}
                            />
                        }
                        className="mb-4"
                    />
                    <div className="space-y-4">
                        <HealthPanel
                            title="WhatsApp"
                            ok={data.integrations.whatsapp.ok}
                            lines={[
                                data.integrations.whatsapp.configured
                                    ? data.integrations.whatsapp.providerReachable
                                        ? 'Провайдер доступен, учётные данные приняты'
                                        : data.integrations.whatsapp.providerMessage || 'Провайдер не отвечает'
                                    : data.integrations.whatsapp.providerMessage || 'Провайдер не настроен',
                                `Последний успех: ${formatDate(data.integrations.whatsapp.lastSuccessDate)}`,
                                data.integrations.whatsapp.recentFailures > 0 ? `Ошибок за 24ч: ${data.integrations.whatsapp.recentFailures}` : 'Нет новых сбоев',
                            ]}
                        />
                        <HealthPanel
                            title="Telegram"
                            ok={data.integrations.telegram.ok}
                            lines={[
                                data.integrations.telegram.configured
                                    ? data.integrations.telegram.providerReachable
                                        ? 'Провайдер доступен, учётные данные приняты'
                                        : data.integrations.telegram.providerMessage || 'Провайдер не отвечает'
                                    : data.integrations.telegram.providerMessage || 'Провайдер не настроен',
                                `Последний успех: ${formatDate(data.integrations.telegram.lastSuccessDate)}`,
                                data.integrations.telegram.recentFailures > 0 ? `Ошибок за 24ч: ${data.integrations.telegram.recentFailures}` : 'Нет новых сбоев',
                            ]}
                        />
                    </div>
                </Card>
            </div>

            <Card variant="outlined" padding="md" className="text-xs text-gray-600 dark:text-gray-400">
                <p>
                    Данные обновляются автоматически каждые 30 секунд. Для детальной информации используйте разделы{' '}
                    <a href="/admin/monitoring" className="text-blue-600 hover:underline dark:text-blue-400">
                        Мониторинг
                    </a>{' '}
                    и{' '}
                    <a href="/admin/health-check" className="text-blue-600 hover:underline dark:text-blue-400">
                        Health Check
                    </a>
                    .
                </p>
            </Card>
        </div>
    );
}

function HealthPanel({
    title,
    ok,
    lines,
}: {
    title: string;
    ok: boolean;
    lines: string[];
}) {
    return (
        <div
            className={`rounded-lg border p-4 ${
                ok
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
            }`}
        >
            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
                <StatusChip status={ok ? 'ok' : 'error'} label={ok ? 'OK' : 'Проблема'} />
            </div>
            <div className="space-y-1.5">
                {lines.map((line, index) => (
                    <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
                        {line}
                    </p>
                ))}
            </div>
        </div>
    );
}

function MetricBlock({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: string | number;
    highlight?: boolean;
}) {
    return (
        <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`mt-1 text-lg font-semibold ${highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
        </div>
    );
}

