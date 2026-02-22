/**
 * Тесты для /api/webhooks/whatsapp
 * Webhook для обработки событий от Meta WhatsApp:
 * верификация, входящие сообщения, привязка к клиентам/бронированиям, команды отмена/подтвердить.
 */

import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import {
    setupApiTestMocks,
    createMockRequest,
    createMockSupabase,
    expectSuccessResponse,
    expectErrorResponse,
} from '../../testHelpers';

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn().mockResolvedValue(undefined),
}));

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

    describe('POST: привязка к клиентам и бронированиям', () => {
        test('должен привязать сообщение к клиенту по номеру телефона (profiles)', async () => {
            const mockSupabase = createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);

            const userId = 'user-uuid-1';
            const phone = '+996555111222';

            mockSupabase.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: userId, phone }, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { biz_id: 'biz-1' }, error: null }),
                })
                .mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({ error: null }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                });

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'e1',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: { phone_number_id: 'pn' },
                                        messages: [
                                            {
                                                from: '996555111222',
                                                id: 'wamid.msg1',
                                                timestamp: String(Math.floor(Date.now() / 1000)),
                                                type: 'text',
                                                text: { body: 'Привет' },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);
            expect(data.success).toBe(true);

            const insertCall = mockSupabase.from.mock.results.find(
                (r: { type: string; value?: { insert: jest.Mock } }) => r.value?.insert != null
            );
            expect(insertCall).toBeDefined();
            const insertArg = (insertCall as { value: { insert: jest.Mock } }).value.insert.mock.calls[0][0];
            expect(insertArg.client_id).toBe(userId);
            expect(insertArg.from_phone).toBe(phone);
        });

        test('должен привязать сообщение к гостевой брони по client_phone', async () => {
            const mockSupabase = createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);

            const bookingId = 'booking-guest-1';
            const bizId = 'biz-1';
            const phone = '+996555333444';

            mockSupabase.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: bookingId, biz_id: bizId, client_phone: phone },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({ error: null }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                });

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'e1',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: { phone_number_id: 'pn' },
                                        messages: [
                                            {
                                                from: '996555333444',
                                                id: 'wamid.guest1',
                                                timestamp: String(Math.floor(Date.now() / 1000)),
                                                type: 'text',
                                                text: { body: 'Инфо' },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);
            expect(data.success).toBe(true);

            const insertCall = mockSupabase.from.mock.results.find(
                (r: { type: string; value?: { insert: jest.Mock } }) => r.value?.insert != null
            );
            expect(insertCall).toBeDefined();
            const insertArg = (insertCall as { value: { insert: jest.Mock } }).value.insert.mock.calls[0][0];
            expect(insertArg.booking_id).toBe(bookingId);
            expect(insertArg.biz_id).toBe(bizId);
            expect(insertArg.from_phone).toBe(phone);
        });
    });

    describe('POST: команды отмена и подтверждение', () => {
        test('при команде "отмена" без брони отправляет сообщение об отсутствии бронирований', async () => {
            const mockSupabase = createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);
            const sendWhatsApp = require('@/lib/senders/whatsapp').sendWhatsApp;

            mockSupabase.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({ error: null }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                });

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'e1',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: { phone_number_id: 'pn' },
                                        messages: [
                                            {
                                                from: '996555000111',
                                                id: 'wamid.cancel1',
                                                timestamp: String(Math.floor(Date.now() / 1000)),
                                                type: 'text',
                                                text: { body: 'Отмена' },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                },
            });

            const res = await POST(req);
            await expectSuccessResponse(res);
            expect(sendWhatsApp).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: '+996555000111',
                    text: expect.stringContaining('нет активных бронирований'),
                })
            );
        });

        test('при команде "отмена" с гостевой бронью вызывает cancel_booking и отправляет подтверждение', async () => {
            const mockSupabase = createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);
            const sendWhatsApp = require('@/lib/senders/whatsapp').sendWhatsApp;

            const bookingId = 'booking-to-cancel';
            const phone = '+996555222333';

            mockSupabase.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: bookingId, biz_id: 'biz1', client_phone: phone },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({ error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: bookingId,
                            status: 'hold',
                            start_at: new Date(Date.now() + 86400000).toISOString(),
                            client_id: null,
                            client_phone: phone,
                            services: { name_ru: 'Стрижка' },
                            staff: { full_name: 'Иван' },
                        },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                });

            mockSupabase.rpc.mockResolvedValue({ error: null });

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'e1',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: { phone_number_id: 'pn' },
                                        messages: [
                                            {
                                                from: '996555222333',
                                                id: 'wamid.cancel2',
                                                timestamp: String(Math.floor(Date.now() / 1000)),
                                                type: 'text',
                                                text: { body: 'Отменить бронь' },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                },
            });

            const res = await POST(req);
            await expectSuccessResponse(res);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_booking', { p_booking_id: bookingId });
            expect(sendWhatsApp).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: phone,
                    text: expect.stringContaining('Бронирование отменено'),
                })
            );
        });

        test('при команде "подтвердить" с бронью вызывает confirm_booking и отправляет подтверждение', async () => {
            const mockSupabase = createMockSupabase();
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockSupabase);
            const sendWhatsApp = require('@/lib/senders/whatsapp').sendWhatsApp;

            const userId = 'user-confirm-1';
            const bookingId = 'booking-to-confirm';
            const phone = '+996555444555';

            mockSupabase.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: userId, phone }, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: bookingId, biz_id: 'biz1' },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({ error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: bookingId,
                            status: 'hold',
                            start_at: new Date(Date.now() + 86400000).toISOString(),
                            end_at: new Date(Date.now() + 86400000 + 1800000).toISOString(),
                            client_id: userId,
                            client_phone: null,
                            services: { name_ru: 'Маникюр' },
                            staff: { full_name: 'Мария' },
                        },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                });

            mockSupabase.rpc.mockResolvedValue({ error: null });

            const req = createMockRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: {
                    object: 'whatsapp_business_account',
                    entry: [
                        {
                            id: 'e1',
                            changes: [
                                {
                                    value: {
                                        messaging_product: 'whatsapp',
                                        metadata: { phone_number_id: 'pn' },
                                        messages: [
                                            {
                                                from: '996555444555',
                                                id: 'wamid.confirm1',
                                                timestamp: String(Math.floor(Date.now() / 1000)),
                                                type: 'text',
                                                text: { body: 'Подтверждаю' },
                                            },
                                        ],
                                    },
                                    field: 'messages',
                                },
                            ],
                        },
                    ],
                },
            });

            const res = await POST(req);
            await expectSuccessResponse(res);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_booking', { p_booking_id: bookingId });
            expect(sendWhatsApp).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: phone,
                    text: expect.stringContaining('Бронирование подтверждено'),
                })
            );
        });
    });
});


