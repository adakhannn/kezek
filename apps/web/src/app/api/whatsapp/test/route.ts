// apps/web/src/app/api/whatsapp/test/route.ts
import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Тестовый endpoint для проверки конфигурации WhatsApp
 * GET /api/whatsapp/test
 */
export async function GET() {
    return withErrorHandler('WhatsAppTest', async () => {
        const hasToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
        const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
        const hasVerifyToken = !!process.env.WHATSAPP_VERIFY_TOKEN;

        const tokenPreview = process.env.WHATSAPP_ACCESS_TOKEN
            ? `${process.env.WHATSAPP_ACCESS_TOKEN.slice(0, 10)}...${process.env.WHATSAPP_ACCESS_TOKEN.slice(-5)}`
            : 'не установлен';

        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'не установлен';
        const tokenLength = process.env.WHATSAPP_ACCESS_TOKEN?.length || 0;

        // Проверяем формат Phone Number ID (должен быть числом)
        const phoneIdIsValid = phoneId !== 'не установлен' && /^\d+$/.test(phoneId);

        return createSuccessResponse({
            configured: hasToken && hasPhoneId && phoneIdIsValid,
            details: {
                WHATSAPP_ACCESS_TOKEN: hasToken ? `${tokenPreview} (${tokenLength} символов)` : 'не установлен',
                WHATSAPP_PHONE_NUMBER_ID: phoneId,
                WHATSAPP_PHONE_NUMBER_ID_VALID: phoneIdIsValid,
                WHATSAPP_VERIFY_TOKEN: hasVerifyToken ? 'установлен' : 'не установлен',
            },
            message: hasToken && hasPhoneId && phoneIdIsValid
                ? 'WhatsApp настроен правильно'
                : hasToken && hasPhoneId && !phoneIdIsValid
                ? 'WHATSAPP_PHONE_NUMBER_ID должен быть числом (например: 1185726307058446)'
                : 'WhatsApp не настроен: проверьте переменные окружения',
            troubleshooting: {
                'Object with ID does not exist': [
                    '1. Проверьте, что WHATSAPP_PHONE_NUMBER_ID правильный (найдите в Meta Developers → WhatsApp → API Setup)',
                    '2. Убедитесь, что Phone Number ID связан с вашим WhatsApp Business Account',
                    '3. Проверьте, что WHATSAPP_ACCESS_TOKEN имеет права на отправку сообщений',
                    '4. Убедитесь, что номер телефона добавлен в WhatsApp Business Account',
                ],
            },
        });
    });
}

