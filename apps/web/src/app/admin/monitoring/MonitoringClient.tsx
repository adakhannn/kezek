'use client';

import { useEffect, useState } from 'react';

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

    // Фильтры для метрик
    const [metricsFilters, setMetricsFilters] = useState({
        endpoint: '',
        method: '',
        statusCode: '',
        errorType: '',
        minDuration: '',
    });

    // Фильтры для логов
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

    const getStatusColor = (statusCode: number) => {
        if (statusCode >= 500) return 'text-red-600 dark:text-red-400';
        if (statusCode >= 400) return 'text-amber-600 dark:text-amber-400';
        return 'text-green-600 dark:text-green-400';
    };

    const getLogLevelColor = (level: string) => {
        switch (level) {
            case 'error':
                return 'text-red-600 dark:text-red-400';
            case 'warn':
                return 'text-amber-600 dark:text-amber-400';
            case 'info':
                return 'text-blue-600 dark:text-blue-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Мониторинг и аналитика</h1>

            {/* Табы */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'stats'
                            ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                    Статистика
                </button>
                <button
                    onClick={() => setActiveTab('metrics')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'metrics'
                            ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                    Метрики API
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'logs'
                            ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                    Логи операций
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
                    <p className="text-red-700 dark:text-red-200">Ошибка: {error}</p>
                </div>
            )}

            {/* Статистика */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {loading && !stats ? (
                        <div className="text-center py-8">Загрузка статистики...</div>
                    ) : stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Всего запросов</p>
                                <p className="text-2xl font-bold">{stats.total_requests}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Успешных</p>
                                <p className="text-2xl font-bold text-green-600">{stats.success_count}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Ошибок</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {stats.client_error_count + stats.server_error_count}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Среднее время</p>
                                <p className="text-2xl font-bold">{formatDuration(stats.avg_duration_ms)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">P95</p>
                                <p className="text-2xl font-bold">{formatDuration(stats.p95_duration_ms)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">P99</p>
                                <p className="text-2xl font-bold">{formatDuration(stats.p99_duration_ms)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Процент ошибок</p>
                                <p className="text-2xl font-bold">{stats.error_rate.toFixed(2)}%</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Эндпоинт</p>
                                <p className="text-lg font-medium truncate">{stats.endpoint}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Нет данных для отображения
                        </div>
                    )}
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Загрузка...' : 'Обновить'}
                    </button>
                </div>
            )}

            {/* Метрики API */}
            {activeTab === 'metrics' && (
                <div className="space-y-6">
                    {/* Фильтры */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <h2 className="text-lg font-semibold mb-4">Фильтры</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Эндпоинт</label>
                                <input
                                    type="text"
                                    value={metricsFilters.endpoint}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, endpoint: e.target.value })}
                                    placeholder="/api/staff/finance"
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Метод</label>
                                <select
                                    value={metricsFilters.method}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, method: e.target.value })}
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Все</option>
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Статус код</label>
                                <input
                                    type="number"
                                    value={metricsFilters.statusCode}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, statusCode: e.target.value })}
                                    placeholder="200, 400, 500..."
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Тип ошибки</label>
                                <select
                                    value={metricsFilters.errorType}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, errorType: e.target.value })}
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Все</option>
                                    <option value="validation">Validation</option>
                                    <option value="database">Database</option>
                                    <option value="auth">Auth</option>
                                    <option value="server">Server</option>
                                    <option value="network">Network</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Мин. время (мс)</label>
                                <input
                                    type="number"
                                    value={metricsFilters.minDuration}
                                    onChange={(e) => setMetricsFilters({ ...metricsFilters, minDuration: e.target.value })}
                                    placeholder="1000"
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                />
                            </div>
                        </div>
                        <button
                            onClick={loadMetrics}
                            disabled={loading}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Загрузка...' : 'Применить фильтры'}
                        </button>
                    </div>

                    {/* Таблица метрик */}
                    {loading && metrics.length === 0 ? (
                        <div className="text-center py-8">Загрузка метрик...</div>
                    ) : metrics.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Время</th>
                                        <th className="px-4 py-2 text-left">Эндпоинт</th>
                                        <th className="px-4 py-2 text-left">Метод</th>
                                        <th className="px-4 py-2 text-left">Статус</th>
                                        <th className="px-4 py-2 text-left">Время</th>
                                        <th className="px-4 py-2 text-left">Ошибка</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map((metric) => (
                                        <tr key={metric.id} className="border-t border-gray-200 dark:border-gray-700">
                                            <td className="px-4 py-2">
                                                {new Date(metric.created_at).toLocaleString('ru-RU')}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-sm">{metric.endpoint}</td>
                                            <td className="px-4 py-2">{metric.method}</td>
                                            <td className={`px-4 py-2 font-semibold ${getStatusColor(metric.status_code)}`}>
                                                {metric.status_code}
                                            </td>
                                            <td className="px-4 py-2">{formatDuration(metric.duration_ms)}</td>
                                            <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
                                                {metric.error_message || metric.error_type || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Нет метрик для отображения
                        </div>
                    )}
                </div>
            )}

            {/* Логи операций */}
            {activeTab === 'logs' && (
                <div className="space-y-6">
                    {/* Фильтры */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <h2 className="text-lg font-semibold mb-4">Фильтры</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Тип операции</label>
                                <select
                                    value={logsFilters.operationType}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, operationType: e.target.value })}
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Все</option>
                                    <option value="shift_open">Открытие смены</option>
                                    <option value="shift_close">Закрытие смены</option>
                                    <option value="item_create">Создание клиента</option>
                                    <option value="item_update">Обновление клиента</option>
                                    <option value="item_delete">Удаление клиента</option>
                                    <option value="items_save">Сохранение списка</option>
                                    <option value="error">Ошибка</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Уровень</label>
                                <select
                                    value={logsFilters.logLevel}
                                    onChange={(e) => setLogsFilters({ ...logsFilters, logLevel: e.target.value })}
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Все</option>
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warn</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={loadLogs}
                            disabled={loading}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Загрузка...' : 'Применить фильтры'}
                        </button>
                    </div>

                    {/* Таблица логов */}
                    {loading && logs.length === 0 ? (
                        <div className="text-center py-8">Загрузка логов...</div>
                    ) : logs.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Время</th>
                                        <th className="px-4 py-2 text-left">Тип</th>
                                        <th className="px-4 py-2 text-left">Уровень</th>
                                        <th className="px-4 py-2 text-left">Сотрудник</th>
                                        <th className="px-4 py-2 text-left">Сообщение</th>
                                        <th className="px-4 py-2 text-left">Ошибка</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-t border-gray-200 dark:border-gray-700">
                                            <td className="px-4 py-2">
                                                {new Date(log.created_at).toLocaleString('ru-RU')}
                                            </td>
                                            <td className="px-4 py-2">{log.operation_type}</td>
                                            <td className={`px-4 py-2 font-semibold ${getLogLevelColor(log.log_level)}`}>
                                                {log.log_level}
                                            </td>
                                            <td className="px-4 py-2">
                                                {log.staff?.full_name || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm">{log.message}</td>
                                            <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
                                                {log.error_message || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Нет логов для отображения
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

