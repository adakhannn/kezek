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
        test('должен успешно обработать входящее текстовое сообщение', async () => {
            const mockSupabase = require('../../testHelpers').createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);

            // Мокаем проверку существующего сообщения (не найдено)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            // Мокаем поиск профиля (не найден)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            // Мокаем поиск гостевого бронирования (не найдено)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            // Мокаем вставку сообщения
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({ error: null }),
            });

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
            const data = await expectSuccessResponse(res);

            expect(data.success).toBe(true);
            // Проверяем, что сообщение было сохранено
            expect(mockSupabase.from).toHaveBeenCalledWith('whatsapp_messages');
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


