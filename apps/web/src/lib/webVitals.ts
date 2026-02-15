/**
 * Утилиты для мониторинга Core Web Vitals и производительности фронтенда
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';

export interface WebVitalsMetric {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
    navigationType: string;
    url: string;
    timestamp: number;
}

export interface PageLoadMetric {
    page: string;
    loadTime: number; // DOMContentLoaded
    domInteractive: number;
    domComplete: number;
    firstPaint: number | null;
    firstContentfulPaint: number | null;
    timeToFirstByte: number | null;
    timestamp: number;
}

export interface RenderMetric {
    page: string;
    renderTime: number;
    componentCount: number;
    timestamp: number;
}

// Пороговые значения для Core Web Vitals
const THRESHOLDS = {
    LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
    FID: { good: 100, poor: 300 }, // First Input Delay
    CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
    FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
    TTFB: { good: 800, poor: 1800 }, // Time to First Byte
    INP: { good: 200, poor: 500 }, // Interaction to Next Paint
};

/**
 * Определяет рейтинг метрики на основе пороговых значений
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
    if (!threshold) {
        return 'good';
    }

    if (value <= threshold.good) {
        return 'good';
    }
    if (value <= threshold.poor) {
        return 'needs-improvement';
    }
    return 'poor';
}

/**
 * Отправляет метрику на сервер
 */
async function sendMetric(metric: WebVitalsMetric | PageLoadMetric | RenderMetric): Promise<void> {
    try {
        // Используем sendBeacon для надежной доставки метрик
        // даже если страница закрывается
        const blob = new Blob([JSON.stringify(metric)], {
            type: 'application/json',
        });

        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/metrics/frontend', blob);
        } else {
            // Fallback для старых браузеров
            fetch('/api/metrics/frontend', {
                method: 'POST',
                body: JSON.stringify(metric),
                headers: { 'Content-Type': 'application/json' },
                keepalive: true, // Важно для отправки перед закрытием страницы
            }).catch(() => {
                // Игнорируем ошибки, чтобы не влиять на UX
            });
        }
    } catch (error) {
        // Игнорируем ошибки отправки метрик
        if (process.env.NODE_ENV === 'development') {
            console.warn('[WebVitals] Failed to send metric:', error);
        }
    }
}

/**
 * Обработчик для Core Web Vitals метрик
 */
function handleMetric(metric: Metric): void {
    const webVitalsMetric: WebVitalsMetric = {
        name: metric.name,
        value: metric.value,
        rating: getRating(metric.name, metric.value),
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        url: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: Date.now(),
    };

    sendMetric(webVitalsMetric);

    // Логируем в dev режиме
    if (process.env.NODE_ENV === 'development') {
        console.log(`[WebVitals] ${metric.name}:`, {
            value: metric.value,
            rating: webVitalsMetric.rating,
            delta: metric.delta,
        });
    }
}

/**
 * Инициализирует мониторинг Core Web Vitals
 */
export function initWebVitals(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Подписываемся на все Core Web Vitals метрики
    // Примечание: onFID устарел в web-vitals v5, используем onINP вместо него
    onCLS(handleMetric);
    onFCP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric);
}

/**
 * Измеряет время загрузки страницы
 */
export function measurePageLoad(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
        return;
    }

    // Ждем полной загрузки страницы
    if (document.readyState === 'complete') {
        sendPageLoadMetric();
    } else {
        window.addEventListener('load', sendPageLoadMetric, { once: true });
    }
}

/**
 * Отправляет метрику загрузки страницы
 */
function sendPageLoadMetric(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
        return;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) {
        return;
    }

    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((entry) => entry.name === 'first-contentful-paint');

    const pageLoadMetric: PageLoadMetric = {
        page: window.location.pathname,
        loadTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        domComplete: navigation.domComplete - navigation.fetchStart,
        firstPaint: paint.find((entry) => entry.name === 'first-paint')?.startTime || null,
        firstContentfulPaint: fcp?.startTime || null,
        timeToFirstByte: navigation.responseStart - navigation.requestStart,
        timestamp: Date.now(),
    };

    sendMetric(pageLoadMetric);

    if (process.env.NODE_ENV === 'development') {
        console.log('[PageLoad] Metrics:', pageLoadMetric);
    }
}

/**
 * Измеряет время рендеринга компонента
 */
export function measureRender(componentName: string, renderTime: number, componentCount?: number): void {
    if (typeof window === 'undefined') {
        return;
    }

    const renderMetric: RenderMetric = {
        page: window.location.pathname,
        renderTime,
        componentCount: componentCount || 1,
        timestamp: Date.now(),
    };

    // Отправляем только медленные рендеры (>16ms для 60fps)
    if (renderTime > 16) {
        sendMetric(renderMetric);

        if (process.env.NODE_ENV === 'development') {
            console.warn(`[Render] Slow render in ${componentName}:`, renderMetric);
        }
    }
}

/**
 * Инициализирует весь мониторинг производительности фронтенда
 */
export function initFrontendPerformanceMonitoring(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Инициализируем Core Web Vitals
    initWebVitals();

    // Измеряем время загрузки страницы
    measurePageLoad();

    // Мониторинг производительности рендеринга через PerformanceObserver
    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure' && entry.name.startsWith('render-')) {
                        const componentName = entry.name.replace('render-', '');
                        measureRender(componentName, entry.duration);
                    }
                }
            });

            observer.observe({ entryTypes: ['measure'] });
        } catch (error) {
            // PerformanceObserver может не поддерживаться в некоторых браузерах
            if (process.env.NODE_ENV === 'development') {
                console.warn('[Performance] PerformanceObserver not supported:', error);
            }
        }
    }
}

