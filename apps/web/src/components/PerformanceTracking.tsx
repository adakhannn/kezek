/**
 * Компонент для инициализации мониторинга производительности фронтенда
 * Должен быть добавлен в корневой layout
 */

'use client';

import { useEffect } from 'react';

import { initFrontendPerformanceMonitoring } from '@/lib/webVitals';

export function PerformanceTracking() {
    useEffect(() => {
        // Инициализируем мониторинг производительности
        initFrontendPerformanceMonitoring();
    }, []);

    return null; // Компонент не рендерит ничего
}

