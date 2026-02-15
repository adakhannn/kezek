/**
 * Интеграционные тесты для /api/services/create
 * Создание новой услуги
 */

import { POST } from '@/app/api/services/create/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

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

describe('/api/services/create', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId: 'biz-id',
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 если отсутствует name_ru', async () => {
            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: { duration_min: 60, price_from: 1000 },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });

        test('должен вернуть 400 если duration_min <= 0', async () => {
            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: { name_ru: 'Test Service', duration_min: 0, price_from: 1000 },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });

        test('должен вернуть 400 если price_to < price_from', async () => {
            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: { name_ru: 'Test Service', duration_min: 60, price_from: 2000, price_to: 1000 },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });

        test('должен вернуть 400 если отсутствуют branch_ids и branch_id', async () => {
            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: { name_ru: 'Test Service', duration_min: 60, price_from: 1000 },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'VALIDATION');
        });
    });

    describe('Успешное создание', () => {
        test('должен успешно создать услугу с одним филиалом (branch_id)', async () => {
            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'service-id', name_ru: 'Test Service', biz_id: 'biz-id' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                    branch_id: 'branch-id',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.id).toBe('service-id');
        });

        test('должен успешно создать услугу с несколькими филиалами (branch_ids)', async () => {
            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'service-id', name_ru: 'Test Service', biz_id: 'biz-id' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    name_en: 'Test Service EN',
                    name_ky: 'Test Service KY',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                    branch_ids: ['branch-id-1', 'branch-id-2'],
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.id).toBe('service-id');
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть ошибку при ошибке БД', async () => {
            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                }),
            });

            const req = createMockRequest('http://localhost/api/services/create', {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 60,
                    price_from: 1000,
                    branch_id: 'branch-id',
                },
            });

            const res = await POST(req);
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});

