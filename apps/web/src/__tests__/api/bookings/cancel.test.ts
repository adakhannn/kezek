/**
 * Тесты для /api/bookings/[id]/cancel
 * Отмена бронирования
 */

import { POST } from '@/app/api/bookings/[id]/cancel/route';
import {
    setupApiTestMocks,
    createMockRequest,
    createMockSupabase,
    expectSuccessResponse,
    expectErrorResponse,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Мокаем getRouteParamUuid
jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(async (context: unknown, param: string) => {
        if (typeof context === 'object' && context !== null && 'params' in context) {
            const params = (context as { params: Record<string, string> }).params;
            return params[param];
        }
        return 'booking-id-123';
    }),
}));

// Мокаем fetch для notify
global.fetch = jest.fn();

describe('/api/bookings/[id]/cancel', () => {
    const mockSupabase = createMockSupabase();
    const bookingId = 'booking-id-123';

    beforeEach(() => {
        jest.clearAllMocks();

        (cookies as jest.Mock).mockResolvedValue({
            get: () => undefined,
        });

        (createServerClient as jest.Mock).mockReturnValue(mockSupabase);
        
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
        process.env.NEXT_PUBLIC_SITE_ORIGIN = 'http://localhost';
    });

    describe('Авторизация', () => {
        test('должен вернуть 403 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            // Получение бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: bookingId, client_id: 'other-user-id', status: 'confirmed' },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: bookingId } });
            await expectErrorResponse(res, 403, 'forbidden');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 403 если пользователь не имеет прав на отмену', async () => {
            const userId = 'user-id';
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            // Получение бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: bookingId, client_id: 'other-user-id', status: 'confirmed' },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: bookingId } });
            await expectErrorResponse(res, 403, 'forbidden');
        });
    });

    describe('Успешная отмена', () => {
        test('должен успешно отменить бронирование', async () => {
            const userId = 'user-id';
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            // Получение бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: bookingId, client_id: userId, status: 'confirmed' },
                    error: null,
                }),
            });

            // RPC для отмены
            mockSupabase.rpc.mockResolvedValueOnce({
                data: null,
                error: null,
            });

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
            });

            const req = createMockRequest(`http://localhost/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: bookingId } });
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'cancel_booking',
                expect.objectContaining({ p_booking_id: bookingId })
            );
        });
    });

    describe('Валидация статуса', () => {
        test('должен вернуть успех если бронирование уже отменено', async () => {
            const userId = 'user-id';
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: bookingId, client_id: userId, status: 'cancelled' },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: bookingId } });
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            // RPC не должен вызываться, если уже отменено
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
        });
    });
});

