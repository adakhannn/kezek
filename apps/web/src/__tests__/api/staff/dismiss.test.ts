/**
 * Тесты для /api/staff/[id]/dismiss
 * Увольнение сотрудника
 */

import { POST } from '@/app/api/staff/[id]/dismiss/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
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

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/staff/[id]/dismiss', () => {
    const mockAdmin = createMockSupabase();
    const mockAdminClient = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const userId = 'user-id';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdminClient);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если сотрудник не найден', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 404, 'STAFF_NOT_FOUND');
        });
    });

    describe('Проверка будущих броней', () => {
        test('должен вернуть 409 если есть будущие активные брони', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    user_id: userId,
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
                    count: 3, // Есть будущие брони
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 409, 'HAS_FUTURE_BOOKINGS');
        });
    });

    describe('Успешное увольнение', () => {
        test('должен успешно уволить сотрудника без будущих броней', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    user_id: userId,
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
                    count: 0, // Нет будущих броней
                    error: null,
                }),
            });

            // Мокаем деактивацию сотрудника
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем работу с ролями
            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'roles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: 'client-role-id' },
                            error: null,
                        }),
                    };
                } else if (table === 'user_roles') {
                    return {
                        delete: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        neq: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                        upsert: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    };
                }
                return mockAdminClient;
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен успешно уволить сотрудника без привязки к пользователю', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    user_id: null, // Нет привязки к пользователю
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
                    count: 0,
                    error: null,
                }),
            });

            // Мокаем деактивацию сотрудника
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

