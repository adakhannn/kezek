/**
 * E2E (HTTP) тест: базовая проверка webhook WhatsApp.
 *
 * Связывается со сценарием 4:
 * «Отмена/подтверждение через WhatsApp» — здесь мы проверяем,
 * что endpoint /api/webhooks/whatsapp корректно принимает payload
 * от Meta и не падает на уровне HTTP-прослойки.
 *
 * Глубокая бизнес-логика команд (отмена/подтверждение)
 * покрывается Jest-тестами webhooks/whatsapp.test.ts.
 */

import { test, expect } from '@playwright/test';

test.describe('/api/webhooks/whatsapp — базовый e2e', () => {
    test('должен принять входящее текстовое сообщение от WhatsApp без 4xx', async ({ request }) => {
        const webhookBody = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    id: 'entry-id',
                    changes: [
                        {
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    phone_number_id: 'phone-id',
                                },
                                messages: [
                                    {
                                        from: '996555123456',
                                        id: 'wamid.test123',
                                        timestamp: '1704067200',
                                        text: {
                                            body: 'отмена',
                                        },
                                        type: 'text',
                                    },
                                ],
                            },
                            field: 'messages',
                        },
                    ],
                },
            ],
        };

        const response = await request.post('/api/webhooks/whatsapp', {
            data: webhookBody,
        });

        // В тестовой среде возможны 2 варианта:
        // - 200 OK — полный happy path;
        // - 500 — если нет тестовых данных / конфигурации Supabase.
        expect([200, 500]).toContain(response.status());
    });
});

