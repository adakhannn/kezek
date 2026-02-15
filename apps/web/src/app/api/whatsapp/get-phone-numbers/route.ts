// apps/web/src/app/api/whatsapp/get-phone-numbers/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug } from '@/lib/log';

/**
 * GET /api/whatsapp/get-phone-numbers?account_id=1185726307058446
 * Получает список номеров телефонов для WhatsApp Business Account
 * 
 * Использование:
 * GET /api/whatsapp/get-phone-numbers?account_id=1185726307058446
 */
export async function GET(req: Request) {
    return withErrorHandler<ApiSuccessResponse<{ phone_numbers: unknown; message: string; instructions: { step1: string; step2: string; step3: string } } | { data: unknown; message: string }>>('WhatsAppAPI', async () => {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get('account_id');
        
        if (!accountId) {
            return createErrorResponse('validation', 'Укажите account_id в query параметрах', { 
                code: 'missing_account_id',
                example: '/api/whatsapp/get-phone-numbers?account_id=1185726307058446'
            }, 400);
        }

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        if (!accessToken) {
            return createErrorResponse('internal', 'WHATSAPP_ACCESS_TOKEN не установлен в переменных окружения', { code: 'no_token' }, 500);
        }

        // Пробуем получить номера через account_id (может быть Phone Number ID или Business Account ID)
        const url = `https://graph.facebook.com/v21.0/${accountId}/phone_numbers`;
        
        logDebug('WhatsAppAPI', 'Requesting phone numbers', { url, accountId });

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
            
            return createErrorResponse('validation', errorMessage, { 
                code: 'api_error',
                details: errorDetails,
                url
            }, resp.status);
        }

        const data = await resp.json();
        
        // Если это список номеров
        if (data.data && Array.isArray(data.data)) {
            return createSuccessResponse({
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
        return createSuccessResponse({
            data,
            message: 'Данные получены успешно',
        });
    });
}

