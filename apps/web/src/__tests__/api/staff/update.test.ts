/**
 * Тесты для /api/staff/[id]/update
 * Обновление сотрудника
 */

import { POST } from '@/app/api/staff/[id]/update/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/staff/[id]/update', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';
    const newBranchId = 'new-branch-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    // Отсутствует full_name или branch_id
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при пустом full_name', async () => {
            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: '',
                    branch_id: branchId,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидном branch_id', async () => {
            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: null,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 403 если сотрудник не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: branchId,
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 403);
        });

        test('должен вернуть 400 если новый филиал не принадлежит бизнесу', async () => {
            // Сотрудник принадлежит бизнесу
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: branchId,
                    },
                    error: null,
                })
                // Новый филиал не принадлежит бизнесу
                .mockResolvedValueOnce({
                    data: null,
                    error: 'Resource not found',
                });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: newBranchId,
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 если новый филиал неактивен', async () => {
            // Сотрудник принадлежит бизнесу
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: branchId,
                    },
                    error: null,
                })
                // Новый филиал неактивен
                .mockResolvedValueOnce({
                    data: {
                        id: newBranchId,
                        biz_id: bizId,
                        is_active: false,
                    },
                    error: null,
                });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: newBranchId,
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить данные сотрудника', async () => {
            // Сотрудник принадлежит бизнесу
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: branchId,
                    },
                    error: null,
                })
                // Филиал принадлежит бизнесу и активен
                .mockResolvedValueOnce({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                        is_active: true,
                    },
                    error: null,
                });

            // Мокаем обновление сотрудника
            let callCount = 0;
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'staff') {
                    callCount++;
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({
                            data: { id: staffId },
                            error: null,
                        }),
                    };
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Updated Staff Name',
                    email: 'updated@example.com',
                    phone: '+996555123456',
                    branch_id: branchId,
                    is_active: true,
                    percent_master: 50,
                    percent_salon: 50,
                    hourly_rate: 1000,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен успешно обновить сотрудника при смене филиала', async () => {
            // Сотрудник принадлежит бизнесу
            (checkResourceBelongsToBiz as jest.Mock)
                .mockResolvedValueOnce({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: branchId,
                    },
                    error: null,
                })
                // Новый филиал принадлежит бизнесу и активен
                .mockResolvedValueOnce({
                    data: {
                        id: newBranchId,
                        biz_id: bizId,
                        is_active: true,
                    },
                    error: null,
                });

            // Мокаем обновление сотрудника и смену филиала
            let callCount = 0;
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'staff') {
                    callCount++;
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({
                            data: { id: staffId },
                            error: null,
                        }),
                    };
                } else if (table === 'staff_branch_assignments') {
                    if (callCount === 2) {
                        // Закрытие старого назначения
                        return {
                            update: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            is: jest.fn().mockResolvedValue({
                                data: null,
                                error: null,
                            }),
                        };
                    } else {
                        // Создание нового назначения
                        return {
                            insert: jest.fn().mockResolvedValue({
                                data: null,
                                error: null,
                            }),
                        };
                    }
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/update`, {
                method: 'POST',
                body: {
                    full_name: 'Updated Staff Name',
                    branch_id: newBranchId,
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

