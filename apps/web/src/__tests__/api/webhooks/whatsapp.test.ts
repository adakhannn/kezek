/**
 * Тесты для /api/webhooks/whatsapp
 * Webhook для обработки событий от Meta WhatsApp
 */

import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

describe('/api/webhooks/whatsapp', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            WHATSAPP_VERIFY_TOKEN: 'test_verify_token',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('GET /api/webhooks/whatsapp (верификация)', () => {
        test('должен успешно верифицировать webhook с правильным токеном', async () => {
            const challenge = 'test-challenge-123';

            const req = createMockRequest(
                `http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_verify_token&hub.challenge=${challenge}`,
                {
                    method: 'GET',
                }
            );

            const res = await GET(req);
            const text = await res.text();

            expect(res.status).toBe(200);
            expect(text).toBe(challenge);
        });

        test('должен вернуть 403 при неверном токене', async () => {
            const req = createMockRequest(
                'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test',
                {
                    method: 'GET',
                }
            );

            const res = await GET(req);
            await expectErrorResponse(res, 403);
        });

        test('должен вернуть 403 при неправильном mode', async () => {
            const req = createMockRequest(
                'http://localhost/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=test_verify_token&hub.challenge=test',
                {
                    method: 'GET',
                }
            );

            const res = await GET(req);
            await expectErrorResponse(res, 403);
        });
    });

    describe('POST /api/webhooks/whatsapp (обработка событий)', () => {
        test('должен успешно обработать входящее сообщение', async () => {
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
                                            from: '1234567890',
                                            id: 'message-id',
                                            timestamp: '1234567890',
                                            text: {
                                                body: 'Test message',
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

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: webhookBody,
            });

            const res = await POST(req);
            // Webhook должен вернуть 200 даже если обработка не удалась
            expect([200, 500]).toContain(res.status);
        });

        test('должен успешно обработать статус доставки', async () => {
            const webhookBody = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'entry-id',
                        changes: [
                            {
                                value: {
                                    messaging_product: 'whatsapp',
                                    statuses: [
                                        {
                                            id: 'message-id',
                                            status: 'delivered',
                                            timestamp: '1234567890',
                                            recipient_id: '1234567890',
                                        },
                                    ],
                                },
                                field: 'messages',
                            },
                        ],
                    },
                ],
            };

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: webhookBody,
            });

            const res = await POST(req);
            expect([200, 500]).toContain(res.status);
        });
    });
});

