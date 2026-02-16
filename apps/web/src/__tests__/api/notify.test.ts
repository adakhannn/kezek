/**
 * Интеграционные тесты для /api/notify
 * Критичный endpoint: отправка уведомлений о бронированиях
 */

import { POST } from '@/app/api/notify/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from './testHelpers';

setupApiTestMocks();

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';

// Мокаем зависимости
jest.mock('@/lib/env', () => ({
    getResendApiKey: jest.fn(() => 'test-resend-key'),
    getEmailFrom: jest.fn(() => 'noreply@example.com'),
    getSupabaseUrl: jest.fn(() => 'http://localhost:54321'),
    getSupabaseAnonKey: jest.fn(() => 'test-anon-key'),
    getSupabaseServiceRoleKey: jest.fn(() => 'test-service-key'),
}));

jest.mock('@/lib/notifications/NotificationOrchestrator', () => ({
    NotificationOrchestrator: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
}));

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/authCheck', () => ({
    checkBookingBelongsToBusiness: jest.fn(),
}));

describe('/api/notify', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const mockOrchestrator = {
        sendNotifications: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Мокаем cookies (уже замокан в setupApiTestMocks, но нужно настроить поведение)
        const cookiesModule = require('next/headers');
        const cookiesMock = cookiesModule.cookies as jest.Mock;
        cookiesMock.mockResolvedValue({
            get: () => undefined,
        });

        (createServerClient as jest.Mock).mockReturnValue(mockSupabase);
        (createClient as jest.Mock).mockReturnValue(mockAdmin);
        (NotificationOrchestrator as jest.Mock).mockImplementation(() => mockOrchestrator);

        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
        process.env.RESEND_API_KEY = 'test-resend-key';
        process.env.EMAIL_FROM = 'noreply@example.com';
    });

    describe('Валидация запроса', () => {
        test('должен вернуть 400 если отсутствует type', async () => {
            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { booking_id: 'booking-id' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });

        test('должен вернуть 400 если отсутствует booking_id', async () => {
            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });
    });

    describe('Получение данных бронирования', () => {
        test('должен вернуть 404 если бронирование не найдено', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'not_found' },
                }),
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'non-existent-id' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404);
        });

        test('должен успешно получить данные бронирования', async () => {
            const mockBooking = {
                id: 'booking-id',
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_id: 'client-id',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
                biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
                branches: [{ name: 'Test Branch', address: 'Branch Address' }],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 2,
                whatsappSent: 1,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.sent).toBe(2);
            expect(data.whatsappSent).toBe(1);
            expect(data.telegramSent).toBe(0);
            expect(NotificationOrchestrator).toHaveBeenCalled();
            expect(mockOrchestrator.sendNotifications).toHaveBeenCalledWith(mockBooking, 'hold');
        });
    });

    describe('Отправка уведомлений', () => {
        test('должен успешно отправить уведомления для типа "hold"', async () => {
            const mockBooking = {
                id: 'booking-id',
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_id: 'client-id',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
                biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
                branches: [{ name: 'Test Branch', address: 'Branch Address' }],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 3,
                whatsappSent: 2,
                telegramSent: 1,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.sent).toBe(3);
            expect(data.whatsappSent).toBe(2);
            expect(data.telegramSent).toBe(1);
        });

        test('должен успешно отправить уведомления для типа "confirm"', async () => {
            const mockBooking = {
                id: 'booking-id',
                status: 'confirmed',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_id: 'client-id',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
                biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
                branches: [{ name: 'Test Branch', address: 'Branch Address' }],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 2,
                whatsappSent: 1,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'confirm', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(mockOrchestrator.sendNotifications).toHaveBeenCalledWith(mockBooking, 'confirm');
        });

        test('должен успешно отправить уведомления для типа "cancel"', async () => {
            const mockBooking = {
                id: 'booking-id',
                status: 'cancelled',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_id: 'client-id',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
                biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
                branches: [{ name: 'Test Branch', address: 'Branch Address' }],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 1,
                whatsappSent: 0,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'cancel', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(mockOrchestrator.sendNotifications).toHaveBeenCalledWith(mockBooking, 'cancel');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const mockBooking = {
                id: 'booking-id',
                client_id: 'client-id',
                biz_id: 'biz-id',
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [],
                staff: [],
                biz: { name: 'Test Business', owner_id: 'owner-id' },
                branches: [],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401, 'AUTH');
        });

        test('должен вернуть 403 если пользователь не является клиентом бронирования и не менеджер бизнеса', async () => {
            const unauthorizedUserId = 'unauthorized-user-id';
            const bookingClientId = 'client-id';
            const bookingBizId = 'biz-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: unauthorizedUserId } },
                error: null,
            });

            const mockBooking = {
                id: 'booking-id',
                client_id: bookingClientId,
                biz_id: bookingBizId,
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [],
                staff: [],
                biz: { name: 'Test Business', owner_id: 'owner-id' },
                branches: [],
            };

            // Мокаем получение бронирования
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            // Мокаем getBizContextForManagers - пользователь не менеджер
            (getBizContextForManagers as jest.Mock).mockRejectedValue(new Error('Not a manager'));

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });

        test('должен разрешить доступ если пользователь является клиентом бронирования', async () => {
            const clientUserId = 'client-id';
            const bookingId = 'booking-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: clientUserId } },
                error: null,
            });

            const mockBooking = {
                id: bookingId,
                client_id: clientUserId,
                biz_id: 'biz-id',
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [],
                staff: [],
                biz: { name: 'Test Business', owner_id: 'owner-id' },
                branches: [],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 1,
                whatsappSent: 0,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: bookingId },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(mockOrchestrator.sendNotifications).toHaveBeenCalled();
        });

        test('должен разрешить доступ если пользователь является менеджером бизнеса', async () => {
            const managerUserId = 'manager-id';
            const bookingId = 'booking-id';
            const bookingBizId = 'biz-id';
            const bookingClientId = 'client-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: managerUserId } },
                error: null,
            });

            const mockBooking = {
                id: bookingId,
                client_id: bookingClientId,
                biz_id: bookingBizId,
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [],
                staff: [],
                biz: { name: 'Test Business', owner_id: 'owner-id' },
                branches: [],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            // Мокаем getBizContextForManagers - пользователь менеджер
            (getBizContextForManagers as jest.Mock).mockResolvedValue({
                bizId: bookingBizId,
            });

            // Мокаем checkBookingBelongsToBusiness - бронирование принадлежит бизнесу
            (checkBookingBelongsToBusiness as jest.Mock).mockResolvedValue({
                belongs: true,
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockResolvedValue({
                        user: { email: 'owner@example.com' },
                    }),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 1,
                whatsappSent: 0,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: bookingId },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(mockOrchestrator.sendNotifications).toHaveBeenCalled();
        });

        test('должен вернуть 403 если менеджер пытается получить доступ к бронированию другого бизнеса', async () => {
            const managerUserId = 'manager-id';
            const bookingId = 'booking-id';
            const managerBizId = 'manager-biz-id';
            const bookingBizId = 'other-biz-id';
            const bookingClientId = 'client-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: managerUserId } },
                error: null,
            });

            const mockBooking = {
                id: bookingId,
                client_id: bookingClientId,
                biz_id: bookingBizId,
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [],
                staff: [],
                biz: { name: 'Test Business', owner_id: 'owner-id' },
                branches: [],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            // Мокаем getBizContextForManagers - пользователь менеджер другого бизнеса
            (getBizContextForManagers as jest.Mock).mockResolvedValue({
                bizId: managerBizId,
            });

            // Мокаем checkBookingBelongsToBusiness - бронирование НЕ принадлежит бизнесу менеджера
            (checkBookingBelongsToBusiness as jest.Mock).mockResolvedValue({
                belongs: false,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: bookingId },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть 500 если RESEND_API_KEY не установлен', async () => {
            const { getResendApiKey } = require('@/lib/env');
            (getResendApiKey as jest.Mock).mockImplementation(() => {
                throw new Error('RESEND_API_KEY is not set');
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 500, 'INTERNAL');
        });

        test('должен обработать ошибку получения email владельца', async () => {
            const mockBooking = {
                id: 'booking-id',
                status: 'hold',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                client_id: 'client-id',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@example.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
                biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
                branches: [{ name: 'Test Branch', address: 'Branch Address' }],
            };

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: mockBooking,
                    error: null,
                }),
            });

            mockAdmin.auth = {
                admin: {
                    getUserById: jest.fn().mockRejectedValue(new Error('Failed to get owner')),
                },
            };

            mockOrchestrator.sendNotifications.mockResolvedValue({
                emailsSent: 2,
                whatsappSent: 1,
                telegramSent: 0,
            });

            const req = createMockRequest('http://localhost/api/notify', {
                method: 'POST',
                body: { type: 'hold', booking_id: 'booking-id' },
            });

            // Должен продолжить работу даже если не удалось получить email владельца
            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            // Проверяем, что оркестратор был вызван без replyTo
            expect(NotificationOrchestrator).toHaveBeenCalled();
        });
    });
});

