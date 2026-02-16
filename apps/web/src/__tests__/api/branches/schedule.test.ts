/**
 * Тесты для /api/branches/[id]/schedule
 * Управление расписанием филиала
 */

import { POST, GET } from '@/app/api/branches/[id]/schedule/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
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

describe('/api/branches/[id]/schedule', () => {
    const mockAdmin = createMockSupabase();
    const branchId = 'branch-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(branchId);
    });

    describe('POST /api/branches/[id]/schedule', () => {
        describe('Валидация', () => {
            test('должен вернуть 400 если schedule не является массивом', async () => {
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: branchId,
                            biz_id: bizId,
                        },
                        error: null,
                    }),
                });

                const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                    method: 'POST',
                    body: {
                        schedule: 'not-an-array',
                    },
                });

                const res = await POST(req, { params: { id: branchId } });
                await expectErrorResponse(res, 400);
            });
        });

        describe('Проверка прав доступа', () => {
            test('должен вернуть 404 если филиал не найден', async () => {
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                });

                const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                    method: 'POST',
                    body: {
                        schedule: [],
                    },
                });

                const res = await POST(req, { params: { id: branchId } });
                await expectErrorResponse(res, 404);
            });
        });

        describe('Успешное сохранение', () => {
            test('должен успешно сохранить расписание', async () => {
                // Мокаем проверку филиала
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: branchId,
                            biz_id: bizId,
                        },
                        error: null,
                    }),
                });

                // Мокаем удаление старого расписания
                mockAdmin.from.mockReturnValueOnce({
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                });

                // Мокаем вставку нового расписания
                mockAdmin.from.mockReturnValueOnce({
                    insert: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                });

                const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                    method: 'POST',
                    body: {
                        schedule: [
                            {
                                day_of_week: 1,
                                intervals: [{ start: '09:00', end: '18:00' }],
                                breaks: [],
                            },
                        ],
                    },
                });

                const res = await POST(req, { params: { id: branchId } });
                const data = await expectSuccessResponse(res, 200);

                expect(data).toHaveProperty('ok', true);
            });
        });
    });

    describe('GET /api/branches/[id]/schedule', () => {
        describe('Проверка прав доступа', () => {
            test('должен вернуть 404 если филиал не найден', async () => {
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                });

                const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                    method: 'GET',
                });

                const res = await GET(req, { params: { id: branchId } });
                await expectErrorResponse(res, 404);
            });
        });

        describe('Успешное получение', () => {
            test('должен успешно получить расписание', async () => {
                // Мокаем проверку филиала
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: branchId,
                            biz_id: bizId,
                        },
                        error: null,
                    }),
                });

                // Мокаем получение расписания
                mockAdmin.from.mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [
                            {
                                day_of_week: 1,
                                intervals: [{ start: '09:00', end: '18:00' }],
                                breaks: [],
                            },
                        ],
                        error: null,
                    }),
                });

                const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                    method: 'GET',
                });

                const res = await GET(req, { params: { id: branchId } });
                const data = await expectSuccessResponse(res, 200);

                expect(data).toHaveProperty('ok', true);
                expect(data).toHaveProperty('schedule');
            });
        });
    });
});


