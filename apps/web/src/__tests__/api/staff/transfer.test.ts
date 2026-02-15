/**
 * Тесты для /api/staff/[id]/transfer
 * Перевод сотрудника между филиалами
 */

import { POST } from '@/app/api/staff/[id]/transfer/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/staff/[id]/transfer', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const currentBranchId = 'current-branch-uuid';
    const targetBranchId = 'target-branch-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии target_branch_id', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    branch_id: currentBranchId,
                },
                error: null,
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {},
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'TARGET_BRANCH_REQUIRED');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 403 если сотрудник не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {
                    target_branch_id: targetBranchId,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 403, 'STAFF_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 400 если сотрудник уже в целевом филиале', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    branch_id: targetBranchId, // Уже в целевом филиале
                },
                error: null,
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {
                    target_branch_id: targetBranchId,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'ALREADY_IN_TARGET_BRANCH');
        });

        test('должен вернуть 400 если целевой филиал не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: currentBranchId,
                    },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: null,
                    error: 'Resource not found',
                });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {
                    target_branch_id: targetBranchId,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'BRANCH_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 400 если целевой филиал неактивен', async () => {
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: currentBranchId,
                    },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: {
                        id: targetBranchId,
                        biz_id: bizId,
                        is_active: false, // Неактивен
                    },
                    error: null,
                });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {
                    target_branch_id: targetBranchId,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'TARGET_BRANCH_INACTIVE');
        });
    });

    describe('Успешный перевод', () => {
        test('должен успешно перевести сотрудника в другой филиал', async () => {
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: currentBranchId,
                    },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: {
                        id: targetBranchId,
                        biz_id: bizId,
                        is_active: true,
                    },
                    error: null,
                });

            // Мокаем проверку текущего назначения
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'assignment-id',
                        valid_from: '2024-01-01',
                        branch_id: currentBranchId,
                    },
                    error: null,
                }),
            });

            // Мокаем проверку будущих назначений
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            // Мокаем закрытие старого назначения
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем создание нового назначения
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем обновление branch_id в staff
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
                method: 'POST',
                body: {
                    target_branch_id: targetBranchId,
                    copy_schedule: false,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

