// apps/web/src/app/api/webhooks/whatsapp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kezek_whatsapp_verify';

/**
 * GET - верификация webhook от Meta
 * Meta отправляет GET запрос с параметрами hub.mode, hub.challenge, hub.verify_token
 * Нужно вернуть hub.challenge если verify_token совпадает
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Проверяем, что это запрос верификации от Meta
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        // Meta ожидает challenge как plain text, а не JSON
        return new NextResponse(challenge, { status: 200 });
    }

    // Если токен не совпадает, возвращаем 403
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST - обработка входящих webhooks от Meta
 * Обрабатываем события: входящие сообщения, статусы доставки и т.д.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Meta отправляет webhook в формате:
        // {
        //   "object": "whatsapp_business_account",
        //   "entry": [
        //     {
        //       "id": "...",
        //       "changes": [
        //         {
        //           "value": {
        //             "messaging_product": "whatsapp",
        //             "metadata": {...},
        //             "messages": [...], // входящие сообщения
        //             "statuses": [...]  // статусы доставки
        //           },
        //           "field": "messages"
        //         }
        //       ]
        //     }
        //   ]
        // }

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value;

                    // Обработка входящих сообщений
                    if (value.messages) {
                        for (const message of value.messages) {
                            await handleIncomingMessage(message);
                        }
                    }

                    // Обработка статусов доставки
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            await handleStatusUpdate(status);
                        }
                    }
                }
            }
        }

        // Всегда возвращаем 200, чтобы Meta не считал запрос неудачным
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        // Все равно возвращаем 200, чтобы Meta не повторял запрос
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
    }
}

type WhatsAppMessage = {
    from: string;
    id: string;
    type: string;
    timestamp: string;
    text?: { body: string };
};

type WhatsAppStatus = {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
};

/**
 * Обработка входящего сообщения
 */
async function handleIncomingMessage(message: WhatsAppMessage) {
    // Здесь можно добавить логику обработки входящих сообщений
    // Например, автоматические ответы, интеграция с чат-ботом и т.д.

    // Пример: если это текстовое сообщение
    if (message.type === 'text') {
        const text = message.text?.body;
        // TODO: добавить обработку текстовых сообщений
        void text; // временно, чтобы избежать unused variable
    }
}

/**
 * Обработка обновления статуса сообщения
 */
async function handleStatusUpdate(status: WhatsAppStatus) {
    // Здесь можно добавить логику обновления статусов в базе данных
    // Например, отмечать, что уведомление было доставлено/прочитано
    void status; // временно, чтобы избежать unused variable
}

