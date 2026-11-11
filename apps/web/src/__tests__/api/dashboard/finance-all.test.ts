/**
 * Тесты для /api/dashboard/finance/all
 * Финансовая статистика бизнеса (реэкспорт из dashboard/staff/finance/all)
 */

import { GET } from '@/app/api/dashboard/finance/all/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/dashboard/finance/all', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-uuid',
            bizId,
        });

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('должен успешно вернуть статистику (реэкспорт)', async () => {

        (mockAdmin.rpc as jest.Mock).mockResolvedValue({
            data: { branches: [], staff: [], shifts: [], closedStats: [] },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/dashboard/finance/all?period=day&date=2024-01-15', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});

