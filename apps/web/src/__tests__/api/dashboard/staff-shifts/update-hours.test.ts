/**
 * Тесты для /api/dashboard/staff-shifts/[id]/update-hours
 * Обновление отработанных часов смены
 */

import { POST } from '@/app/api/dashboard/staff-shifts/[id]/update-hours/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

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

describe('/api/dashboard/staff-shifts/[id]/update-hours', () => {
    const mockAdmin = createMockSupabase();
    const shiftId = 'shift-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(shiftId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидном JSON', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: 'invalid-json',
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 400, 'INVALID_JSON');
        });

        test('должен вернуть 400 при отсутствии hours_worked', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {},
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 400, 'INVALID_HOURS_VALUE');
        });

        test('должен вернуть 400 при отрицательном hours_worked', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: -1,
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 400, 'INVALID_HOURS_VALUE');
        });

        test('должен вернуть 400 при hours_worked > 48', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: 49,
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 400, 'INVALID_HOURS_VALUE');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если смена не найдена', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: 8,
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 404, 'SHIFT_NOT_FOUND_OR_FORBIDDEN');
        });

        test('должен вернуть 400 если смена не закрыта', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: shiftId,
                    biz_id: bizId,
                    staff_id: 'staff-id',
                    status: 'open', // Смена открыта
                    total_amount: 10000,
                    consumables_amount: 1000,
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 500,
                    guaranteed_amount: 0,
                    master_share: 0,
                    salon_share: 0,
                    topup_amount: 0,
                },
                error: null,
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: 8,
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            await expectErrorResponse(res, 400, 'ONLY_CLOSED_SHIFTS_CAN_BE_ADJUSTED');
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить часы для закрытой смены', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: shiftId,
                    biz_id: bizId,
                    staff_id: 'staff-id',
                    status: 'closed', // Смена закрыта
                    total_amount: 10000,
                    consumables_amount: 1000,
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 500,
                    guaranteed_amount: 0,
                    master_share: 0,
                    salon_share: 0,
                    topup_amount: 0,
                },
                error: null,
            });

            // Мокаем обновление смены
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: {
                        id: shiftId,
                        hours_worked: 8,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: 8,
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен корректно округлить hours_worked до 2 знаков', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: shiftId,
                    biz_id: bizId,
                    staff_id: 'staff-id',
                    status: 'closed',
                    total_amount: 10000,
                    consumables_amount: 1000,
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 500,
                    guaranteed_amount: 0,
                    master_share: 0,
                    salon_share: 0,
                    topup_amount: 0,
                },
                error: null,
            });

            // Мокаем обновление смены
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: {
                        id: shiftId,
                        hours_worked: 8.33, // Округлено до 2 знаков
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff-shifts/${shiftId}/update-hours`, {
                method: 'POST',
                body: {
                    hours_worked: 8.333333, // Будет округлено до 8.33
                },
            });

            const res = await POST(req, { params: { id: shiftId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

