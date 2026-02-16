/**
 * API endpoint для приема метрик производительности фронтенда
 * Core Web Vitals, время загрузки страниц, метрики рендеринга
 */


import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getIpAddress } from '@/lib/apiMetrics';
import { logDebug, logWarn } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type WebVitalsMetric = {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
    navigationType: string;
    url: string;
    timestamp: number;
};

type PageLoadMetric = {
    page: string;
    loadTime: number;
    domInteractive: number;
    domComplete: number;
    firstPaint: number | null;
    firstContentfulPaint: number | null;
    timeToFirstByte: number | null;
    timestamp: number;
};

type RenderMetric = {
    page: string;
    renderTime: number;
    componentCount: number;
    timestamp: number;
};

type FrontendMetric = WebVitalsMetric | PageLoadMetric | RenderMetric;

/**
 * Определяет тип метрики
 */
function getMetricType(metric: FrontendMetric): 'web-vitals' | 'page-load' | 'render' {
    if ('name' in metric && 'rating' in metric) {
        return 'web-vitals';
    }
    if ('loadTime' in metric) {
        return 'page-load';
    }
    return 'render';
}

/**
 * Сохраняет метрику в базу данных
 */
async function saveMetric(metric: FrontendMetric, req: Request): Promise<void> {
    const admin = getServiceClient();
    const metricType = getMetricType(metric);

    try {
        // Получаем информацию о пользователе (если авторизован)
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Получаем IP адрес и User-Agent
        const ipAddress = getIpAddress(req);
        const userAgent = req.headers.get('user-agent') || null;

        // Извлекаем page из метрики
        let page: string | null = null;
        if ('page' in metric) {
            page = metric.page;
        } else if ('url' in metric) {
            page = metric.url;
        }

        // Используем RPC функцию для сохранения метрики
        const { error } = await admin.rpc('log_frontend_metric', {
            p_metric_type: metricType,
            p_metric_data: metric,
            p_timestamp: new Date(metric.timestamp).toISOString(),
            p_user_id: user?.id || null,
            p_page: page,
            p_user_agent: userAgent,
            p_ip_address: ipAddress || null,
        });

        if (error) {
            // Если функция не существует, логируем предупреждение
            // но не прерываем выполнение
            logWarn('FrontendMetrics', 'RPC function log_frontend_metric not found', {
                error: error.message,
            });
        }
    } catch (error) {
        // Игнорируем ошибки сохранения метрик
        logWarn('FrontendMetrics', 'Failed to save metric', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export async function POST(req: Request) {
    return withErrorHandler('FrontendMetrics', async () => {
        // Парсим тело запроса
        let metric: FrontendMetric;
        try {
            const body = await req.json();
            metric = body as FrontendMetric;
        } catch (error) {
            return createErrorResponse('validation', 'Invalid JSON body', undefined, 400);
        }

        // Валидация базовых полей
        if (!metric || typeof metric !== 'object') {
            return createErrorResponse('validation', 'Invalid metric data', undefined, 400);
        }

        // Сохраняем метрику асинхронно (не блокируем ответ)
        saveMetric(metric, req).catch(() => {
            // Игнорируем ошибки сохранения
        });

        // Логируем в dev режиме
        if (process.env.NODE_ENV === 'development') {
            logDebug('FrontendMetrics', `Received ${getMetricType(metric)} metric`, {
                metric,
            });
        }

        return createSuccessResponse({ ok: true });
    });
}

