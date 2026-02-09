// apps/web/src/components/dev/PerformanceMonitor.tsx
/**
 * Компонент для отображения метрик производительности в dev режиме
 * Показывает количество рендеров компонентов и API запросы
 */

'use client';

import { useEffect, useState } from 'react';

import { getApiStats } from '@/lib/apiLogger';

export function PerformanceMonitor() {
    const [stats, setStats] = useState(getApiStats());
    const [isVisible, setIsVisible] = useState(false);

    // Работает только в dev режиме
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    useEffect(() => {
        const interval = setInterval(() => {
            setStats(getApiStats());
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Показываем только если есть данные
    if (stats.totalCalls === 0 && !isVisible) {
        return null;
    }

    return (
        <div
            className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg max-w-sm"
            style={{ fontFamily: 'monospace' }}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">Performance Monitor</h3>
                <button
                    onClick={() => setIsVisible(!isVisible)}
                    className="text-gray-400 hover:text-white"
                >
                    {isVisible ? '−' : '+'}
                </button>
            </div>

            {isVisible && (
                <div className="space-y-2">
                    <div>
                        <div className="text-gray-400">API Calls:</div>
                        <div className="text-green-400">{stats.totalCalls}</div>
                    </div>

                    {stats.duplicateCalls > 0 && (
                        <div>
                            <div className="text-gray-400">Duplicate Calls:</div>
                            <div className="text-yellow-400">⚠️ {stats.duplicateCalls}</div>
                        </div>
                    )}

                    {Object.keys(stats.callsByUrl).length > 0 && (
                        <div>
                            <div className="text-gray-400">Calls by URL:</div>
                            <div className="max-h-32 overflow-y-auto">
                                {Object.entries(stats.callsByUrl)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 5)
                                    .map(([url, count]) => (
                                        <div key={url} className="text-xs">
                                            <span className="text-blue-400">{count}x</span>{' '}
                                            <span className="text-gray-300">{url}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-700 text-xs text-gray-500">
                        Press F12 → Network tab for details
                    </div>
                </div>
            )}
        </div>
    );
}

