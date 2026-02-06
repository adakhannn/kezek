/**
 * Тесты для /api/quick-hold
 * Критичная операция: быстрое создание брони (hold + confirm) для клиента
 */

import { POST } from '@/app/api/quick-hold/route';

// Мокируем rate limiting, чтобы не мешал тестам
jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {},
}));

// Мокаем next/headers cookies
jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));

// Мокаем supabase-js и ssr клиенты
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

describe('/api/quick-hold', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSupabase: any = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        order: jest.fn(() => mockSupabase),
        limit: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        single: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Для веб-ветки (cookies)
        (cookies as jest.Mock).mockResolvedValue({
            get: () => undefined,
        });

        (createServerClient as jest.Mock).mockReturnValue(mockSupabase);
        (createClient as jest.Mock).mockReturnValue(mockSupabase);

        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    });

    describe('Edge cases', () => {
        test('должен вернуть 401, если пользователь не авторизован (web cookies)', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const req = new Request('http://localhost/api/quick-hold', {
                method: 'POST',
                body: JSON.stringify({
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.ok).toBe(false);
            expect(data.error).toBe('auth');
        });

        test('успешный hold + confirm брони', async () => {
            const userId = 'test-user-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            // Поиск первого активного филиала
            // branch lookup: эмулируем цепочку from().select().eq().eq().order().limit().maybeSingle()
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

            // RPC hold_slot
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

            // Проверка статуса брони после confirm_booking
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'booking-id-123', status: 'confirmed' },
                    error: null,
                }),
            } as never);

            const req = new Request('http://localhost/api/quick-hold', {
                method: 'POST',
                body: JSON.stringify({
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.booking_id).toBe('booking-id-123');
            expect(data.confirmed).toBe(true);

            // Проверяем, что RPC был вызван с ожидаемыми аргументами
            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'hold_slot',
                expect.objectContaining({
                    p_biz_id: 'biz-id',
                    p_service_id: 'service-id',
                    p_staff_id: 'staff-id',
                }),
            );
        });

        test('обрабатывает ошибку RPC hold_slot (например, конфликт слота)', async () => {
            const userId = 'test-user-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            // branch lookup
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

            // RPC возвращает ошибку (слот занят / конфликт)
            mockSupabase.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'slot conflict' },
            });

            const req = new Request('http://localhost/api/quick-hold', {
                method: 'POST',
                body: JSON.stringify({
                    biz_id: 'biz-id',
                    service_id: 'service-id',
                    staff_id: 'staff-id',
                    start_at: new Date().toISOString(),
                }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toBe('rpc');
        });
    });
});


