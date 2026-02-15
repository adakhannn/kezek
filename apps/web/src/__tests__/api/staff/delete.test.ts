/**
 * Тесты для /api/staff/[id]/delete
 * Удаление сотрудника
 */

import { POST } from '@/app/api/staff/[id]/delete/route';
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

describe('/api/staff/[id]/delete', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если сотрудник не найден', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 404);
        });
    });

    describe('Проверка будущих броней', () => {
        test('должен вернуть 409 если есть будущие активные брони', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    user_id: 'user-id',
                    is_active: true,
                    full_name: 'Test Staff',
                },
                error: null,
            });

            // Мокаем проверку будущих броней
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({
                    count: 5, // Есть будущие брони
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 409);
        });
    });

    describe('Успешное удаление', () => {
        test('должен успешно удалить сотрудника без будущих броней', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    user_id: 'user-id',
                    is_active: true,
                    full_name: 'Test Staff',
                },
                error: null,
            });

            // Мокаем все операции удаления
            let callCount = 0;
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'bookings') {
                    callCount++;
                    if (callCount === 1) {
                        // Проверка будущих броней
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            neq: jest.fn().mockReturnThis(),
                            gt: jest.fn().mockResolvedValue({
                                count: 0, // Нет будущих броней
                                error: null,
                            }),
                        };
                    } else {
                        // Удаление прошедших броней
                        return {
                            delete: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            lt: jest.fn().mockResolvedValue({
                                data: null,
                                error: null,
                            }),
                        };
                    }
                } else if (table === 'working_hours' || table === 'service_staff' || table === 'staff_branch_assignments' || table === 'staff_schedule_rules') {
                    // Удаление связанных данных
                    return {
                        delete: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    };
                } else if (table === 'staff') {
                    // Удаление сотрудника
                    return {
                        delete: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    };
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

