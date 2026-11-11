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

            mockSupabase.rpc.mockResolvedValue({
                data: { branches: [], staff: [], shifts: [], closedStats: [] },
                error: null,
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
            const branchId = '11111111-1111-4111-8111-111111111111';

            mockSupabase.rpc.mockResolvedValue({
                data: { branches: [], staff: [], shifts: [], closedStats: [] },
                error: null,
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

            mockSupabase.rpc.mockResolvedValue({
                data: { branches: [], staff: [], shifts: [], closedStats: [] },
                error: null,
            });

            const req = new Request('http://localhost/api/dashboard/finance/all?period=invalid', {
                method: 'GET',
            });

            const response = await GET(req);

            // Неверный период отклоняется до запроса данных
            expect(response.status).toBe(400);
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
        });
    });
});

