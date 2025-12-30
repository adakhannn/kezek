// apps/web/src/app/api/whatsapp/get-phone-numbers/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/get-phone-numbers?account_id=1185726307058446
 * Получает список номеров телефонов для WhatsApp Business Account
 * 
 * Использование:
 * GET /api/whatsapp/get-phone-numbers?account_id=1185726307058446
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get('account_id');
        
        if (!accountId) {
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'missing_account_id',
                    message: 'Укажите account_id в query параметрах',
                    example: '/api/whatsapp/get-phone-numbers?account_id=1185726307058446'
                },
                { status: 400 }
            );
        }

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'no_token',
                    message: 'WHATSAPP_ACCESS_TOKEN не установлен в переменных окружения'
                },
                { status: 500 }
            );
        }

        // Пробуем получить номера через account_id (может быть Phone Number ID или Business Account ID)
        const url = `https://graph.facebook.com/v21.0/${accountId}/phone_numbers`;
        
        console.log('[whatsapp/get-phone-numbers] Requesting:', url);

        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!resp.ok) {
            const errText = await resp.text();
            let errorMessage = `Graph API error: HTTP ${resp.status}`;
            let errorDetails: unknown = null;
            
            try {
                const errJson = JSON.parse(errText);
                errorMessage += ` — ${errJson.error?.message || errText.slice(0, 500)}`;
                errorDetails = errJson.error;
                
                // Специальная обработка ошибки Missing Permission
                if (errJson.error?.code === 100 || errJson.error?.type === 'OAuthException') {
                    errorMessage += '\n\nОшибка: Недостаточно разрешений для доступа к номерам телефонов.';
                    errorMessage += '\n\nРешение:';
                    errorMessage += '\n1. Зайди в Meta Developers → Настройки компании → Пользователи системы';
                    errorMessage += '\n2. Выбери пользователя системы, который используется для генерации токена';
                    errorMessage += '\n3. Убедись, что у него есть разрешения:';
                    errorMessage += '\n   - whatsapp_business_messaging';
                    errorMessage += '\n   - whatsapp_business_management';
                    errorMessage += '\n   - business_management';
                    errorMessage += '\n4. Сгенерируй новый Long-lived token с этими разрешениями';
                    errorMessage += '\n5. Обнови WHATSAPP_ACCESS_TOKEN в переменных окружения';
                } else if (errJson.error?.code === 100) {
                    errorMessage += '\n\nВозможно, account_id неверный. Попробуйте использовать WhatsApp Business Account ID.';
                }
            } catch {
                errorMessage += ` — ${errText.slice(0, 500)}`;
            }
            
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'api_error',
                    message: errorMessage,
                    details: errorDetails,
                    url
                },
                { status: resp.status }
            );
        }

        const data = await resp.json();
        
        // Если это список номеров
        if (data.data && Array.isArray(data.data)) {
            return NextResponse.json({
                ok: true,
                phone_numbers: data.data,
                message: `Найдено ${data.data.length} номер(ов)`,
                instructions: {
                    step1: 'Найдите нужный номер телефона в списке выше',
                    step2: 'Скопируйте значение поля "id" (это и есть Phone Number ID)',
                    step3: 'Установите его в переменную окружения WHATSAPP_PHONE_NUMBER_ID',
                }
            });
        }
        
        // Если это один номер
        return NextResponse.json({
            ok: true,
            data,
            message: 'Данные получены успешно',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[whatsapp/get-phone-numbers] error:', e);
        return NextResponse.json(
            { ok: false, error: 'internal', message: msg },
            { status: 500 }
        );
    }
}

