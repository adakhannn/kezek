/**
 * Тесты для /api/cron/close-shifts
 * Критичная операция: автоматическое закрытие просроченных смен
 */

import { GET } from '@/app/api/cron/close-shifts/route';
// Мокируем зависимости
jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { getServiceClient } from '@/lib/supabaseService';

describe('/api/cron/close-shifts', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        lte: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue(mockSupabase);
        process.env.CRON_SECRET = 'test-cron-secret';
    });

    describe('Авторизация', () => {
        test('должен отклонить запрос без секретного ключа', async () => {
            const req = new Request('http://localhost/api/cron/close-shifts', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.ok).toBe(false);
            expect(data.error).toBe('Unauthorized');
        });

        test('должен отклонить запрос с неверным секретным ключом', async () => {
            const req = new Request('http://localhost/api/cron/close-shifts', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer wrong-secret',
                },
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.ok).toBe(false);
        });

        test('должен принять запрос с правильным секретным ключом', async () => {
            // Мокируем цепочку вызовов для поиска открытых смен
            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                    data: [], // нет открытых смен
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce(mockQuery);

            const req = new Request('http://localhost/api/cron/close-shifts', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer test-cron-secret',
                },
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
        });
    });

    describe('Edge cases', () => {
        test('должен обработать отсутствие открытых смен', async () => {
            mockSupabase.select.mockReturnValueOnce({
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = new Request('http://localhost/api/cron/close-shifts', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer test-cron-secret',
                },
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
        });

        test('должен обработать ошибку базы данных', async () => {
            // Мокируем цепочку вызовов для поиска открытых смен (с ошибкой)
            const mockQuery = {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                }),
            };
            mockSupabase.from.mockReturnValueOnce(mockQuery);

            const req = new Request('http://localhost/api/cron/close-shifts', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer test-cron-secret',
                },
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
        });
    });
});

