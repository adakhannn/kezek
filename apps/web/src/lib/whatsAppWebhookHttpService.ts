import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppVerifyToken } from '@/lib/env';
import { processWhatsAppWebhookBody } from '@/lib/whatsAppWebhookService';
import { verifyWhatsAppWebhookSignature } from '@/lib/whatsAppWebhookSignature';
import { InvalidWhatsAppPayload } from '@/lib/whatsappInbox/parse';
import { WhatsAppInboxStoreError } from '@/lib/whatsappInbox/store';

async function readWebhookBytes(req: Request): Promise<Uint8Array> {
    const reader = req.body?.getReader();
    if (!reader) throw new Error('missing_body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([(async () => {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 524288) throw new Error('body_too_large');
                chunks.push(chunk.value);
            }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            return bytes;
        })(), new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error('body_deadline')); }, 2000);
        })]);
    } finally { if (timer) clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

export async function runWhatsAppWebhookGetHttp(req: NextRequest): Promise<NextResponse> {
    const searchParams = new URL(req.url).searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = getWhatsAppVerifyToken();
    if (verifyToken && mode === 'subscribe' && token === verifyToken && challenge) {
        return new NextResponse(challenge, { status: 200 });
    }

    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
}

export async function runWhatsAppWebhookPostHttp(req: NextRequest): Promise<NextResponse> {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!appSecret) {
        return createErrorResponse('service_unavailable', 'Webhook не настроен', undefined, 503);
    }
    let rawBody: Uint8Array;
    try { rawBody = await readWebhookBytes(req); }
    catch { return createErrorResponse('validation', 'Некорректный размер или срок чтения webhook', undefined, 400); }
    if (!verifyWhatsAppWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
        return createErrorResponse('forbidden', 'Неверная подпись webhook', undefined, 403);
    }
    let body: unknown;
    try {
        body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
    } catch {
        return createErrorResponse('validation', 'Некорректный JSON', undefined, 400);
    }

    try { await processWhatsAppWebhookBody(body); }
    catch (error) {
        if (error instanceof InvalidWhatsAppPayload || (error instanceof WhatsAppInboxStoreError && error.code === 'INBOX_INVALID_INPUT')) {
            return createErrorResponse('validation', 'Некорректный webhook', undefined, 400);
        }
        if (error instanceof WhatsAppInboxStoreError && error.code === 'INBOX_PAYLOAD_CONFLICT') {
            return createErrorResponse('conflict', 'Идентификатор сообщения уже связан с другим содержимым', undefined, 409);
        }
        return createErrorResponse('service_unavailable', 'Не удалось надёжно сохранить webhook', undefined, 503);
    }

    return createSuccessResponse(undefined, { success: true });
}

