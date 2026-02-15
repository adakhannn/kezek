/**
 * Интеграционные тесты для /api/branches/create
 * Создание нового филиала
 */

import { POST } from '@/app/api/branches/create/route';
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

describe('/api/branches/create', () => {
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

    describe('Авторизация', () => {
        test('должен вернуть 403 если пользователь не суперадмин', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: false,
                error: null,
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: 'Test Branch' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 если отсутствует name', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'NAME_REQUIRED');
        });

        test('должен вернуть 400 если name пустой', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: '   ' },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'NAME_REQUIRED');
        });

        test('должен вернуть 400 если координаты некорректны', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: 'Test Branch', lat: 200, lon: 200 }, // Некорректные координаты
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное создание', () => {
        test('должен успешно создать филиал без координат', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'branch-id', name: 'Test Branch', biz_id: 'biz-id' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: 'Test Branch', address: 'Test Address', is_active: true },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.id).toBe('branch-id');
        });

        test('должен успешно создать филиал с координатами', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'branch-id', name: 'Test Branch', biz_id: 'biz-id', coords: 'POINT(74.5 42.8)' },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: 'Test Branch', lat: 42.8, lon: 74.5 },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
            expect(data.id).toBe('branch-id');
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть ошибку при ошибке БД', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            mockServiceClient.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                }),
            });

            const req = createMockRequest('http://localhost/api/branches/create', {
                method: 'POST',
                body: { name: 'Test Branch' },
            });

            const res = await POST(req);
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});

