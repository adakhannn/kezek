/**
 * Тесты для /api/dashboard/finance/all
 * Финансовая статистика бизнеса (реэкспорт из dashboard/staff/finance/all)
 */

import { GET } from '@/app/api/dashboard/finance/all/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/dashboard/finance/all', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('должен успешно вернуть статистику (реэкспорт)', async () => {
        // Мокаем получение сотрудников
        mockAdmin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        });

        const req = createMockRequest('http://localhost/api/dashboard/finance/all?period=day&date=2024-01-15', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});

