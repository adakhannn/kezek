// apps/web/src/app/api/auth/mobile-exchange/route.ts
import crypto from 'crypto';

import { NextRequest } from 'next/server';

import { withErrorHandler, createErrorResponse, createSuccessResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';
import { logWarn } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

// Временное хранилище для токенов (в продакшене лучше использовать Redis)
const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number; createdAt: number }>();

// Очистка истекших токенов каждые 5 минут
// Сохраняем intervalId для возможной очистки (хотя в Next.js API routes это не критично, т.к. они stateless)
let cleanupInterval: NodeJS.Timeout | null = null;

// Функция для запуска очистки (вызывается при первом использовании)
function startCleanupInterval() {
    if (cleanupInterval) return; // Уже запущен
    
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [code, data] of tokenStore.entries()) {
            if (data.expiresAt < now) {
                tokenStore.delete(code);
            }
        }
        // Ограничиваем размер кэша (максимум 1000 записей)
        if (tokenStore.size > 1000) {
            // Удаляем самые старые записи
            const entries = Array.from(tokenStore.entries())
                .sort((a, b) => a[1].createdAt - b[1].createdAt);
            const toDelete = entries.slice(0, tokenStore.size - 1000);
            toDelete.forEach(([code]) => tokenStore.delete(code));
        }
    }, 5 * 60 * 1000);
}

// Запускаем очистку при первом импорте модуля
startCleanupInterval();

/**
 * POST /api/auth/mobile-exchange
 * Сохраняет токены и возвращает код для обмена
 */
export async function POST(request: NextRequest) {
    // Применяем rate limiting для аутентификации
    return withRateLimit(
        request,
        RateLimitConfigs.auth,
        () =>
            withErrorHandler('MobileExchange', async () => {
                const { accessToken, refreshToken } = await request.json();

                if (!accessToken || !refreshToken) {
                    return createErrorResponse('validation', 'Необходимо указать accessToken и refreshToken', undefined, 400);
                }

                // Генерируем уникальный код (6 символов)
                const code = crypto.randomBytes(3).toString('hex').toUpperCase();
                
                // Сохраняем токены на 10 минут
                const now = Date.now();
                tokenStore.set(code, {
                    accessToken,
                    refreshToken,
                    expiresAt: now + 10 * 60 * 1000, // 10 минут
                    createdAt: now,
                });

                logWarn('MobileExchange', 'Token stored', { code, expiresAt: new Date(now + 10 * 60 * 1000).toISOString() });

                return createSuccessResponse({ code });
            })
    );
}

/**
 * GET /api/auth/mobile-exchange?code=XXX
 * Обменивает код на токены
 * 
 * GET /api/auth/mobile-exchange?check=true
 * Проверяет, есть ли pending токены (возвращает последний созданный код, если он еще не истек)
 */
export async function GET(request: NextRequest) {
    return withErrorHandler<ApiSuccessResponse<{ hasPending: boolean; code?: string; createdAt?: number } | { accessToken: string; refreshToken: string }>>('MobileExchange', async () => {
        const searchParams = request.nextUrl.searchParams;
        const check = searchParams.get('check');
        
        // Если это проверка на pending токены
        if (check === 'true') {
            // Находим последний созданный код, который еще не истек
            const now = Date.now();
            let latestCode: string | null = null;
            let latestCreatedAt = 0;
            
            for (const [code, data] of tokenStore.entries()) {
                if (data.expiresAt > now && data.createdAt > latestCreatedAt) {
                    latestCode = code;
                    latestCreatedAt = data.createdAt;
                }
            }
            
            if (latestCode) {
                return createSuccessResponse({ 
                    hasPending: true, 
                    code: latestCode,
                    createdAt: latestCreatedAt,
                });
            }
            
            return createSuccessResponse({ hasPending: false });
        }
        
        // Обычная обработка обмена кода
        const code = searchParams.get('code');

        if (!code) {
            return createErrorResponse('validation', 'Необходимо указать параметр code', undefined, 400);
        }

        const tokenData = tokenStore.get(code);

        if (!tokenData) {
            return createErrorResponse('not_found', 'Неверный или истекший код', undefined, 404);
        }

        // Проверяем срок действия
        if (tokenData.expiresAt < Date.now()) {
            tokenStore.delete(code);
            return createErrorResponse('validation', 'Код истек', undefined, 410);
        }

        // Удаляем код после использования (одноразовый)
        tokenStore.delete(code);

        return createSuccessResponse({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
        });
    });
}

