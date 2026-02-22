'use client';

import { useEffect, useState } from 'react';

type FunnelStep = {
    step: string;
    stepName: string;
    uniqueSessions: number;
    totalEvents: number;
    conversionRate: number;
};

type FunnelAnalyticsData = {
    funnel: FunnelStep[];
    summary: {
        totalViews: number;
        totalBookings: number;
        overallConversionRate: number;
        totalEvents: number;
    };
};

type FunnelAnalyticsResponse = {
    ok: boolean;
    data: FunnelAnalyticsData;
    error?: string;
};

export default function FunnelAnalyticsClient() {
    const [data, setData] = useState<FunnelAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        source: '' as 'public' | 'quickdesk' | '',
    });

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            if (filters.source) params.set('source', filters.source);

            const response = await fetch(`/api/admin/funnel-analytics?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result: FunnelAnalyticsResponse = await response.json();

            if (!result.ok || !result.data) {
                throw new Error(result.error || 'Failed to load funnel analytics');
            }

            setData(result.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [filters]);

    const getConversionColor = (rate: number) => {
        if (rate >= 50) return 'text-emerald-600 dark:text-emerald-400';
        if (rate >= 30) return 'text-blue-600 dark:text-blue-400';
        if (rate >= 10) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    if (loading && !data) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка аналитики воронки...</p>
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
                        onClick={loadAnalytics}
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
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Аналитика воронки</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Конверсия между шагами процесса бронирования
                </p>
            </div>

            {/* Фильтры */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Фильтры</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                            Дата начала
                        </label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                            Дата окончания
                        </label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                            Источник
                        </label>
                        <select
                            value={filters.source}
                            onChange={(e) => setFilters({ ...filters, source: e.target.value as 'public' | 'quickdesk' | '' })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                        >
                            <option value="">Все</option>
                            <option value="public">Публичный поток</option>
                            <option value="quickdesk">QuickDesk</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Сводка */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Всего просмотров</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.summary.totalViews}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Успешных броней</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.summary.totalBookings}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Общая конверсия</p>
                    <p className={`text-2xl font-bold ${getConversionColor(data.summary.overallConversionRate)}`}>
                        {data.summary.overallConversionRate.toFixed(2)}%
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Всего событий</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.summary.totalEvents}</p>
                </div>
            </div>

            {/* Воронка */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Воронка конверсии</h2>
                <div className="space-y-4">
                    {data.funnel.map((step, index) => (
                        <div key={step.step} className="relative">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                                        {index + 1}
                                    </span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{step.stepName}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {step.uniqueSessions} сессий
                                    </span>
                                    {index > 0 && (
                                        <span className={`text-sm font-semibold ${getConversionColor(step.conversionRate)}`}>
                                            {step.conversionRate.toFixed(2)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                                    style={{
                                        width: `${Math.min((step.uniqueSessions / (data.funnel[0]?.uniqueSessions || 1)) * 100, 100)}%`,
                                    }}
                                />
                            </div>
                            {index > 0 && (
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Конверсия от предыдущего шага: {step.conversionRate.toFixed(2)}%
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

