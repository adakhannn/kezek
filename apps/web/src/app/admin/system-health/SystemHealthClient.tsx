'use client';

import { useEffect, useState } from 'react';
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
            lastSuccessDate: string | null;
            recentFailures: number;
        };
        telegram: {
            ok: boolean;
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
        // Автообновление каждые 30 секунд
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

    const getStatusBadge = (ok: boolean) => (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                ok
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            }`}
        >
            {ok ? '✓ OK' : '✗ Проблема'}
        </span>
    );

    if (loading && !data) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка данных о здоровье системы...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-lg p-6">
                    <h1 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">Ошибка загрузки</h1>
                    <p className="text-red-700 dark:text-red-200">{error}</p>
                    <button
                        onClick={loadHealth}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Здоровье системы</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Агрегированная панель мониторинга состояния системы
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {lastUpdate && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Обновлено: {formatDateTime(lastUpdate.toISOString(), 'ru', true)}
                        </span>
                    )}
                    <button
                        onClick={loadHealth}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        <svg
                            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        {loading ? 'Обновление...' : 'Обновить'}
                    </button>
                </div>
            </div>

            {/* Общий статус */}
            <div
                className={`rounded-xl border p-6 mb-6 ${
                    data.ok
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Общий статус системы
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {data.ok
                                ? 'Все компоненты работают нормально'
                                : 'Обнаружены проблемы в одном или нескольких компонентах'}
                        </p>
                    </div>
                    {getStatusBadge(data.ok)}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Cron-задачи */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cron-задачи</h3>
                        {getStatusBadge(data.cronJobs.shifts.ok && data.cronJobs.ratings.ok)}
                    </div>
                    <div className="space-y-4">
                        <div
                            className={`rounded-lg border p-4 ${
                                data.cronJobs.shifts.ok
                                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">Закрытие смен</span>
                                {getStatusBadge(data.cronJobs.shifts.ok)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Незакрытых смен старше 2 дней: {data.cronJobs.shifts.openShiftsOlderThan2Days}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Последняя проверка: {data.cronJobs.shifts.lastCheckDate}
                            </p>
                        </div>
                        <div
                            className={`rounded-lg border p-4 ${
                                data.cronJobs.ratings.ok
                                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">Пересчет рейтингов</span>
                                {getStatusBadge(data.cronJobs.ratings.ok)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {data.cronJobs.ratings.daysSinceLastMetric !== null
                                    ? `Последний пересчет: ${data.cronJobs.ratings.daysSinceLastMetric} дн. назад`
                                    : 'Рейтинги никогда не пересчитывались'}
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1">
                                <p>Staff: {formatDate(data.cronJobs.ratings.staffLastMetricDate)}</p>
                                <p>Branch: {formatDate(data.cronJobs.ratings.branchLastMetricDate)}</p>
                                <p>Biz: {formatDate(data.cronJobs.ratings.bizLastMetricDate)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* API-метрики */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API-метрики</h3>
                        {getStatusBadge(data.apiMetrics.ok)}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Всего запросов (1ч)</p>
                            <p className="text-lg font-semibold">{data.apiMetrics.totalRequests}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Процент ошибок</p>
                            <p className="text-lg font-semibold">{data.apiMetrics.errorRate.toFixed(2)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Среднее время</p>
                            <p className="text-lg font-semibold">{formatDuration(data.apiMetrics.avgDuration)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">P95</p>
                            <p className="text-lg font-semibold">{formatDuration(data.apiMetrics.p95Duration)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">P99</p>
                            <p className="text-lg font-semibold">{formatDuration(data.apiMetrics.p99Duration)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Ошибок (1ч)</p>
                            <p className={`text-lg font-semibold ${data.apiMetrics.recentErrors > 0 ? 'text-red-600' : ''}`}>
                                {data.apiMetrics.recentErrors}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Ошибки UI */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ошибки UI</h3>
                        {getStatusBadge(data.uiErrors.ok)}
                    </div>
                    <div className="space-y-2">
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Ошибок за последние 24ч</p>
                            <p className={`text-lg font-semibold ${data.uiErrors.recentErrors > 0 ? 'text-red-600' : ''}`}>
                                {data.uiErrors.recentErrors}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Последняя ошибка</p>
                            <p className="text-sm">{formatDate(data.uiErrors.lastErrorDate)}</p>
                        </div>
                    </div>
                </div>

                {/* Интеграции */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Интеграции</h3>
                        {getStatusBadge(data.integrations.whatsapp.ok && data.integrations.telegram.ok)}
                    </div>
                    <div className="space-y-4">
                        <div
                            className={`rounded-lg border p-4 ${
                                data.integrations.whatsapp.ok
                                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">WhatsApp</span>
                                {getStatusBadge(data.integrations.whatsapp.ok)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Последний успех: {formatDate(data.integrations.whatsapp.lastSuccessDate)}
                            </p>
                            {data.integrations.whatsapp.recentFailures > 0 && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Ошибок за 24ч: {data.integrations.whatsapp.recentFailures}
                                </p>
                            )}
                        </div>
                        <div
                            className={`rounded-lg border p-4 ${
                                data.integrations.telegram.ok
                                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">Telegram</span>
                                {getStatusBadge(data.integrations.telegram.ok)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Последний успех: {formatDate(data.integrations.telegram.lastSuccessDate)}
                            </p>
                            {data.integrations.telegram.recentFailures > 0 && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Ошибок за 24ч: {data.integrations.telegram.recentFailures}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
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
            </div>
        </div>
    );
}

