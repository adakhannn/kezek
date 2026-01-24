'use client';

// apps/web/src/app/admin/performance/PerformanceClient.tsx
import { useEffect, useState } from 'react';

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
        // Обновляем статистику каждые 30 секунд
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const getStatusColor = (operation: string, duration: number) => {
        const thresholds: Record<string, { warn: number; error: number }> = {
            'get_free_slots_service_day_v2': { warn: 2000, error: 5000 },
            'shift_close': { warn: 3000, error: 10000 },
            'apply_promotion': { warn: 1000, error: 3000 },
            'recalculate_ratings': { warn: 30000, error: 60000 },
        };

        const threshold = thresholds[operation];
        if (!threshold) return 'text-gray-600 dark:text-gray-400';

        if (duration >= threshold.error) return 'text-red-600 dark:text-red-400';
        if (duration >= threshold.warn) return 'text-amber-600 dark:text-amber-400';
        return 'text-green-600 dark:text-green-400';
    };

    if (loading && stats.length === 0) {
        return <div className="text-center py-8">Загрузка метрик...</div>;
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-lg p-4">
                <p className="text-red-700 dark:text-red-200">Ошибка: {error}</p>
                <button
                    onClick={loadStats}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Повторить
                </button>
            </div>
        );
    }

    if (stats.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Нет данных о производительности
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {lastUpdate && `Последнее обновление: ${lastUpdate.toLocaleTimeString()}`}
                </p>
                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Обновление...' : 'Обновить'}
                </button>
            </div>

            <div className="grid gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.operation}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                    >
                        <h3 className="text-lg font-semibold mb-3">{stat.operation}</h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Запросов</p>
                                <p className="text-lg font-medium">{stat.count}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Среднее</p>
                                <p className={`text-lg font-medium ${getStatusColor(stat.operation, stat.avgDuration)}`}>
                                    {formatDuration(stat.avgDuration)}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">P95</p>
                                <p className={`text-lg font-medium ${getStatusColor(stat.operation, stat.p95Duration)}`}>
                                    {formatDuration(stat.p95Duration)}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">P99</p>
                                <p className={`text-lg font-medium ${getStatusColor(stat.operation, stat.p99Duration)}`}>
                                    {formatDuration(stat.p99Duration)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Мин</p>
                                <p className="font-medium">{formatDuration(stat.minDuration)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Макс</p>
                                <p className="font-medium">{formatDuration(stat.maxDuration)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Ошибок</p>
                                <p className={`font-medium ${stat.errorRate > 0.1 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {(stat.errorRate * 100).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

