/**
 * E2E (HTTP) тест: базовая проверка webhook WhatsApp.
 *
 * Связывается со сценарием 4:
 * «Отмена/подтверждение через WhatsApp» — здесь мы проверяем,
 * что endpoint /api/webhooks/whatsapp принимает подписанный payload от Meta
 * (сохраняет его во входящую очередь) и отклоняет неподписанный.
 *
 * Подпись — HMAC-SHA256 тела с WHATSAPP_APP_SECRET, получатель — WHATSAPP_PHONE_NUMBER_ID;
 * scripts/e2e-seed.mjs выдаёт локальные тестовые значения, с которыми запущено приложение. Ответы в WhatsApp не отправляются.
 * Глубокая бизнес-логика команд (отмена/подтверждение)
 * покрывается Jest-тестами webhooks/whatsapp.test.ts.
 */

import { createHmac } from 'node:crypto';

import { test, expect } from '@playwright/test';

import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('whatsapp-webhook.spec.ts', ['WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID']);

function webhookBody(messageId: string): string {
    return JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
            {
                id: 'entry-id',
                changes: [
                    {
                        value: {
                            messaging_product: 'whatsapp',
                            metadata: { phone_number_id: readRequiredEnv('WHATSAPP_PHONE_NUMBER_ID') },
                            messages: [
                                {
                                    from: '996555123456',
                                    id: messageId,
                                    timestamp: String(Math.floor(Date.now() / 1000)),
                                    text: { body: 'отмена' },
                                    type: 'text',
                                },
                            ],
                        },
                        field: 'messages',
                    },
                ],
            },
        ],
    });
}

test.describe('/api/webhooks/whatsapp — базовый e2e', () => {
    test('должен принять подписанное входящее текстовое сообщение от WhatsApp', async ({ request }) => {
        const body = webhookBody(`wamid.e2e${Date.now()}`);
        const signature = createHmac('sha256', readRequiredEnv('WHATSAPP_APP_SECRET')).update(body).digest('hex');

        const response = await request.post('/api/webhooks/whatsapp', {
            data: body,
            headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${signature}` },
        });

        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ ok: true });
    });

    test('должен отклонить сообщение без верной подписи', async ({ request }) => {
        const response = await request.post('/api/webhooks/whatsapp', {
            data: webhookBody(`wamid.e2e-unsigned${Date.now()}`),
            headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` },
        });

        expect(response.status()).toBe(403);
    });
});
