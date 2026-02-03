/**
 * Тесты для /api/quick-book-guest
 * Публичный endpoint для создания гостевых бронирований
 */

import { POST } from '@/app/api/quick-book-guest/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

describe('/api/quick-book-guest', () => {
    const mockSupabase = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (cookies as jest.Mock).mockResolvedValue({
            get: () => undefined,
        });

        (createClient as jest.Mock).mockReturnValue(mockSupabase);
    });

    describe('Валидация входных данных', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    // Отсутствуют service_id, staff_id, start_at, client_name, client_phone
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидном формате телефона', async () => {
            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: 'invalid-phone', // Невалидный формат (не E.164)
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидном email', async () => {
            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: '+996555123456',
                    client_email: 'invalid-email', // Невалидный email
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное создание бронирования', () => {
        test('должен успешно создать гостевую бронь', async () => {
            // Поиск филиала
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'branch-id' },
                    error: null,
                }),
            });

            // RPC hold_slot_guest
            mockSupabase.rpc
                .mockResolvedValueOnce({
                    data: 'booking-id-123',
                    error: null,
                })
                // confirm_booking
                .mockResolvedValueOnce({
                    data: { ok: true },
                    error: null,
                });

            // Проверка статуса брони
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'booking-id-123', status: 'confirmed' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: '+996555123456',
                    client_email: 'test@example.com',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.booking_id).toBe('booking-id-123');
            expect(data.confirmed).toBe(true);
        });

        test('должен работать без email (опциональное поле)', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'branch-id' },
                    error: null,
                }),
            });

            mockSupabase.rpc
                .mockResolvedValueOnce({
                    data: 'booking-id-123',
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { ok: true },
                    error: null,
                });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'booking-id-123', status: 'confirmed' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: '+996555123456',
                    // client_email отсутствует
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.booking_id).toBe('booking-id-123');
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть 400 если филиал не найден', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: '+996555123456',
                },
            });

            const res = await POST(req);
            const data = await expectErrorResponse(res, 400, 'no_branch');
            expect(data.message).toContain('No active branch');
        });

        test('должен обработать ошибку RPC hold_slot_guest', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'branch-id' },
                    error: null,
                }),
            });

            mockSupabase.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'Slot conflict' },
            });

            const req = createMockRequest('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: {
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                    client_name: 'Test User',
                    client_phone: '+996555123456',
                },
            });

            const res = await POST(req);
            const data = await expectErrorResponse(res, 400, 'rpc');
            expect(data.message).toContain('Slot conflict');
        });
    });
});

