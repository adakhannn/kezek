/**
 * Тесты для /api/dashboard/finance/all
 * Критичная операция: агрегация финансовых данных для всех сотрудников
 */

import { GET } from '@/app/api/dashboard/staff/finance/all/route';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

describe('/api/dashboard/finance/all', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        in: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-uuid',
            bizId: 'test-biz-id',
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
    });

    describe('Edge cases', () => {
        test('должен вернуть пустой список при отсутствии сотрудников', async () => {
            // Мокируем запрос филиалов
            const mockBranchesQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockBranchesQuery),
            });

            // Мокируем запрос сотрудников
            const mockStaffQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockStaffQuery),
            });

            // Мокируем RPC для получения статистики
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    staff_stats: [],
                    total_stats: {
                        total_shifts: 0,
                        closed_shifts: 0,
                        open_shifts: 0,
                        total_amount: 0,
                        total_master: 0,
                        total_salon: 0,
                        total_consumables: 0,
                        total_late_minutes: 0,
                    },
                },
                error: null,
            });

            const mockShiftsQuery = {
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockShiftsQuery),
            });

            const req = new Request('http://localhost/api/dashboard/finance/all?period=day&date=2026-03-04', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(Array.isArray(data.data?.staffStats)).toBe(true);
        });

        test('должен обработать фильтрацию по филиалу', async () => {
            const branchId = 'test-branch-id';

            // Мокируем запрос филиалов
            const mockBranchesQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [{ id: branchId, name: 'Test Branch' }],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockBranchesQuery),
            });

            // Мокируем запрос сотрудников
            const mockStaffQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockStaffQuery),
            });

            mockSupabase.rpc.mockResolvedValue({
                data: {
                    staff_stats: [],
                    total_stats: {
                        total_shifts: 0,
                        closed_shifts: 0,
                        open_shifts: 0,
                        total_amount: 0,
                        total_master: 0,
                        total_salon: 0,
                        total_consumables: 0,
                        total_late_minutes: 0,
                    },
                },
                error: null,
            });

            const mockShiftsQuery = {
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockShiftsQuery),
            });

            const req = new Request(`http://localhost/api/dashboard/finance/all?period=day&date=2026-03-04&branchId=${branchId}`, {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.data?.branchId).toBe(branchId);
        });

        test('должен обработать ошибку RPC', async () => {
            // Мокируем запрос филиалов
            const mockBranchesQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockBranchesQuery),
            });

            // Мокируем запрос сотрудников
            const mockStaffQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockStaffQuery),
            });

            // Мокируем RPC с ошибкой
            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: { message: 'RPC error' },
            });

            const req = new Request('http://localhost/api/dashboard/finance/all', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
        });

        test('должен обработать некорректные параметры периода', async () => {
            // Мокируем запрос филиалов
            const mockBranchesQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockBranchesQuery),
            });

            // Мокируем запрос сотрудников
            const mockStaffQuery = {
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockStaffQuery),
            });

            // Мокируем RPC
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    staff_stats: [],
                    total_stats: {
                        total_shifts: 0,
                        closed_shifts: 0,
                        open_shifts: 0,
                        total_amount: 0,
                        total_master: 0,
                        total_salon: 0,
                        total_consumables: 0,
                        total_late_minutes: 0,
                    },
                },
                error: null,
            });

            // Мокируем запрос открытых смен
            const mockShiftsQuery = {
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            };
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue(mockShiftsQuery),
            });

            const req = new Request('http://localhost/api/dashboard/finance/all?period=invalid', {
                method: 'GET',
            });

            const response = await GET(req);

            // Должен вернуть дефолтный период (day) или ошибку валидации
            expect([200, 400]).toContain(response.status);
        });
    });
});

