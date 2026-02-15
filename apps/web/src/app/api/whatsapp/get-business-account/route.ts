// apps/web/src/app/api/whatsapp/get-business-account/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppAccessToken } from '@/lib/env';
import { logDebug } from '@/lib/log';

/**
 * GET /api/whatsapp/get-business-account
 * Получает WhatsApp Business Account ID и список номеров телефонов
 * 
 * Использование:
 * GET /api/whatsapp/get-business-account
 */

export async function GET() {
    return withErrorHandler<ApiSuccessResponse<{ business_accounts: unknown; selected_account: { id: unknown; name: unknown }; phone_numbers: unknown[]; instructions: { step1: string; step2: string; step3: string } } | { business_accounts: unknown; message: string }>>('WhatsAppAPI', async () => {
        let accessToken: string;
        try {
            accessToken = getWhatsAppAccessToken();
        } catch {
            return createErrorResponse('internal', 'WHATSAPP_ACCESS_TOKEN не установлен в переменных окружения', { code: 'no_token' }, 500);
        }

        // Получаем список Business Accounts
        const url = 'https://graph.facebook.com/v21.0/me/businesses';
        
        logDebug('WhatsAppAPI', 'Requesting business accounts', { url });

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
            let troubleshooting: string[] = [];
            
            try {
                const errJson = JSON.parse(errText);
                errorMessage += ` — ${errJson.error?.message || errText.slice(0, 500)}`;
                errorDetails = errJson.error;
                
                // Специальная обработка ошибки Missing Permission
                if (errJson.error?.code === 100 || errJson.error?.type === 'OAuthException') {
                    troubleshooting = [
                        '1. Зайди в Meta Developers → Настройки компании → Пользователи системы',
                        '2. Выбери пользователя системы, который используется для генерации токена',
                        '3. Убедись, что у него есть разрешения:',
                        '   - whatsapp_business_messaging',
                        '   - whatsapp_business_management',
                        '   - business_management (для доступа к Business Accounts)',
                        '4. Сгенерируй новый Long-lived token с этими разрешениями',
                        '5. Обнови WHATSAPP_ACCESS_TOKEN в переменных окружения',
                    ];
                }
            } catch {
                errorMessage += ` — ${errText.slice(0, 500)}`;
            }
            
            return createErrorResponse('validation', errorMessage, { 
                code: 'api_error',
                details: errorDetails,
                troubleshooting: troubleshooting.length > 0 ? troubleshooting : undefined,
            }, resp.status);
        }

        const data = await resp.json();
        
        // Если есть бизнес-аккаунты, получаем номера для первого
        if (data.data && data.data.length > 0) {
            const businessAccountId = data.data[0].id;
            
            // Получаем номера телефонов для этого аккаунта
            const phoneNumbersUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/phone_numbers`;
            const phoneResp = await fetch(phoneNumbersUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            let phoneNumbers: unknown[] = [];
            if (phoneResp.ok) {
                const phoneData = await phoneResp.json();
                phoneNumbers = phoneData.data || [];
            }

            return createSuccessResponse({
                business_accounts: data.data,
                selected_account: {
                    id: businessAccountId,
                    name: data.data[0].name || 'N/A',
                },
                phone_numbers: phoneNumbers,
                instructions: {
                    step1: 'Используйте "id" из selected_account как WhatsApp Business Account ID',
                    step2: 'Используйте "id" из phone_numbers как WHATSAPP_PHONE_NUMBER_ID',
                    step3: 'Установите эти значения в переменные окружения',
                }
            });
        }

        return createSuccessResponse({
            business_accounts: data.data || [],
            message: 'Бизнес-аккаунты получены, но номера не найдены',
        });
    });
}

