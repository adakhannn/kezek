// apps/web/src/app/api/whatsapp/test/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Тестовый endpoint для проверки конфигурации WhatsApp
 * GET /api/whatsapp/test
 */
export async function GET() {
    const hasToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    const hasVerifyToken = !!process.env.WHATSAPP_VERIFY_TOKEN;

    const tokenPreview = process.env.WHATSAPP_ACCESS_TOKEN
        ? `${process.env.WHATSAPP_ACCESS_TOKEN.slice(0, 10)}...${process.env.WHATSAPP_ACCESS_TOKEN.slice(-5)}`
        : 'не установлен';

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'не установлен';

    return NextResponse.json({
        configured: hasToken && hasPhoneId,
        details: {
            WHATSAPP_ACCESS_TOKEN: hasToken ? tokenPreview : 'не установлен',
            WHATSAPP_PHONE_NUMBER_ID: phoneId,
            WHATSAPP_VERIFY_TOKEN: hasVerifyToken ? 'установлен' : 'не установлен',
        },
        message: hasToken && hasPhoneId
            ? 'WhatsApp настроен правильно'
            : 'WhatsApp не настроен: проверьте переменные окружения',
    });
}

