'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';

type PerformanceStat = {
    operation: string;
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
    errorRate: number;
};

type PerformanceStatsResponse = {
    ok: boolean;
    stats: PerformanceStat[];
    timestamp: number;
    error?: string;
};

export default function PerformanceClient() {
    const [stats, setStats] = useState<PerformanceStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/admin/performance/stats');
            const data: PerformanceStatsResponse = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Failed to load performance stats');
            }

            setStats(data.stats);
            setLastUpdate(new Date(data.timestamp));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const getStatus = (operation: string, duration: number) => {
        const thresholds: Record<string, { warn: number; error: number }> = {
            get_free_slots_service_day_v2: { warn: 2000, error: 5000 },
            shift_close: { warn: 3000, error: 10000 },
            apply_promotion: { warn: 1000, error: 3000 },
            recalculate_ratings: { warn: 30000, error: 60000 },
        };

        const threshold = thresholds[operation];
        if (!threshold) return 'neutral';
        if (duration >= threshold.error) return 'error';
        if (duration >= threshold.warn) return 'warning';
        return 'success';
    };

    if (loading && stats.length === 0) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} variant="elevated" padding="lg">
                        <Skeleton className="mb-3 h-5 w-48" />
                        <SkeletonText lines={4} />
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <AlertBanner
                variant="danger"
                title="Ошибка"
                message={error}
                action={
                    <Button onClick={loadStats} variant="danger" size="sm">
                        Повторить
                    </Button>
                }
            />
        );
    }

    if (stats.length === 0) {
        return <EmptyState compact title="Нет данных" description="Пока нет метрик о производительности." />;
    }

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Производительность"
                description={lastUpdate ? `Последнее обновление: ${lastUpdate.toLocaleTimeString()}` : undefined}
                action={
                    <Button onClick={loadStats} disabled={loading} size="sm">
                        {loading ? 'Обновление...' : 'Обновить'}
                    </Button>
                }
            />

            <div className="grid gap-4">
                {stats.map((stat) => (
                    <Card key={stat.operation} variant="elevated" padding="lg">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stat.operation}</h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Операционная метрика за актуальное окно наблюдения</p>
                            </div>
                            <StatusChip status={getStatus(stat.operation, stat.p95Duration)} label={`P95 ${formatDuration(stat.p95Duration)}`} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                            <MetricBlock label="Запросов" value={stat.count} />
                            <MetricBlock label="Среднее" value={formatDuration(stat.avgDuration)} status={getStatus(stat.operation, stat.avgDuration)} />
                            <MetricBlock label="P95" value={formatDuration(stat.p95Duration)} status={getStatus(stat.operation, stat.p95Duration)} />
                            <MetricBlock label="P99" value={formatDuration(stat.p99Duration)} status={getStatus(stat.operation, stat.p99Duration)} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                            <MetricBlock label="Мин" value={formatDuration(stat.minDuration)} />
                            <MetricBlock label="Макс" value={formatDuration(stat.maxDuration)} />
                            <MetricBlock label="Ошибок" value={`${(stat.errorRate * 100).toFixed(1)}%`} status={stat.errorRate > 0.1 ? 'error' : 'neutral'} />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function MetricBlock({
    label,
    value,
    status = 'neutral',
}: {
    label: string;
    value: string | number;
    status?: 'neutral' | 'success' | 'warning' | 'error';
}) {
    const colorClass =
        status === 'success'
            ? 'text-green-600 dark:text-green-400'
            : status === 'warning'
              ? 'text-amber-600 dark:text-amber-400'
              : status === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-gray-100';

    return (
        <div>
            <p className="text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`mt-1 text-lg font-medium ${colorClass}`}>{value}</p>
        </div>
    );
}

