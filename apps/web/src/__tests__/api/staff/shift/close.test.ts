/**
 * Тесты для /api/staff/shift/close
 * Критичная операция: закрытие смены с расчетом финансов и гарантированной оплаты
 */

import { POST } from '@/app/api/staff/shift/close/route';
// Мокируем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {},
}));

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((operation, fn) => fn()),
}));

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

describe('/api/staff/shift/close', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    };

    const mockAdmin = {
        from: jest.fn(() => mockAdmin),
        select: jest.fn(() => mockAdmin),
        eq: jest.fn(() => mockAdmin),
        update: jest.fn(() => mockAdmin),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'test-staff-id',
            bizId: 'test-biz-id',
            branchId: 'test-branch-id',
        });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Edge cases', () => {
        test('должен обработать закрытие смены с нулевой суммой', async () => {
            // Настройка моков
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'test-shift-id',
                        status: 'open',
                        shift_date: '2026-01-26',
                        total_amount: 0,
                        master_share: 0,
                        salon_share: 0,
                    },
                    error: null,
                }),
            });

            mockAdmin.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    shift: {
                        id: 'test-shift-id',
                        status: 'closed',
                    },
                },
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({
                    totalAmount: 0,
                    consumablesAmount: 0,
                    items: [],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(mockAdmin.rpc).toHaveBeenCalledWith(
                'close_staff_shift_safe',
                expect.objectContaining({
                    p_total_amount: 0,
                })
            );
        });

        test('должен обработать закрытие смены с гарантированной оплатой (0 клиентов)', async () => {
            const hourlyRate = 100;
            const hoursWorked = 8;

            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: hourlyRate,
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'test-shift-id',
                        status: 'open',
                        shift_date: '2026-01-26',
                        total_amount: 0,
                        master_share: 0,
                        salon_share: 0,
                    },
                    error: null,
                }),
            });

            mockAdmin.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    shift: {
                        id: 'test-shift-id',
                        status: 'closed',
                        master_share: hourlyRate * hoursWorked, // гарантированная оплата
                    },
                },
                error: null,
            });

            const req = new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({
                    totalAmount: 0,
                    consumablesAmount: 0,
                    items: [],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            // Проверяем, что гарантированная оплата была рассчитана
            expect(mockAdmin.rpc).toHaveBeenCalledWith(
                'close_staff_shift_safe',
                expect.objectContaining({
                    p_guaranteed_amount: expect.any(Number),
                })
            );
        });

        test('должен отклонить отрицательные суммы', async () => {
            const req = new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({
                    totalAmount: -100,
                    consumablesAmount: 0,
                    items: [],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('отрицательной');
        });

        test('должен отклонить некорректные данные в items', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                },
                error: null,
            });

            const req = new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({
                    totalAmount: 1000,
                    consumablesAmount: 0,
                    items: [
                        { serviceAmount: -50 }, // отрицательная сумма
                    ],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('отрицательной');
        });

        test('должен обработать ошибку при отсутствии открытой смены', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                },
                error: null,
            });

            // Мокируем цепочку вызовов для поиска смены (смена не найдена)
            const mockShiftQuery = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null, // нет открытой смены
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce(mockShiftQuery);

            const req = new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({
                    totalAmount: 1000,
                    consumablesAmount: 0,
                    items: [],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('открытой смены');
        });
    });
});

