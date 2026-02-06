// apps/web/src/app/api/auth/mobile-exchange/route.ts
import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { logWarn, logError } from '@/lib/log';

// Временное хранилище для токенов (в продакшене лучше использовать Redis)
const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number; createdAt: number }>();

// Очистка истекших токенов каждые 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [code, data] of tokenStore.entries()) {
        if (data.expiresAt < now) {
            tokenStore.delete(code);
        }
    }
}, 5 * 60 * 1000);

/**
 * POST /api/auth/mobile-exchange
 * Сохраняет токены и возвращает код для обмена
 */
export async function POST(request: NextRequest) {
    try {
        const { accessToken, refreshToken } = await request.json();

        if (!accessToken || !refreshToken) {
            return NextResponse.json(
                { error: 'Missing accessToken or refreshToken' },
                { status: 400 }
            );
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

        return NextResponse.json({ code });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        logError('MobileExchange', 'Error in POST', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/mobile-exchange?code=XXX
 * Обменивает код на токены
 * 
 * GET /api/auth/mobile-exchange?check=true
 * Проверяет, есть ли pending токены (возвращает последний созданный код, если он еще не истек)
 */
export async function GET(request: NextRequest) {
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
            return NextResponse.json({ 
                hasPending: true, 
                code: latestCode,
                createdAt: latestCreatedAt,
            });
        }
        
        return NextResponse.json({ hasPending: false });
    }
    
    // Обычная обработка обмена кода
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json(
                { error: 'Missing code parameter' },
                { status: 400 }
            );
        }

        const tokenData = tokenStore.get(code);

        if (!tokenData) {
            return NextResponse.json(
                { error: 'Invalid or expired code' },
                { status: 404 }
            );
        }

        // Проверяем срок действия
        if (tokenData.expiresAt < Date.now()) {
            tokenStore.delete(code);
            return NextResponse.json(
                { error: 'Code expired' },
                { status: 410 }
            );
        }

        // Удаляем код после использования (одноразовый)
        tokenStore.delete(code);

        return NextResponse.json({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        logError('MobileExchange', 'Error in GET', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

