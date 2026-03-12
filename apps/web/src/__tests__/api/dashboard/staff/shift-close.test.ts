/**
 * Тесты для POST /api/dashboard/staff/[id]/shift/close
 * Закрытие смены сотрудника от имени владельца/менеджера (сценарий «владелец на странице финансов сотрудника»).
 */

import { POST } from '@/app/api/dashboard/staff/[id]/shift/close/route';
import {
    setupApiTestMocks,
    createMockRequest,
    createMockSupabase,
    expectSuccessResponse,
    expectErrorResponse,
} from '../../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
    RateLimitConfigs: {},
}));

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((_name, fn) => fn()),
}));

jest.mock('@/lib/notifications/shiftNotifications', () => ({
    sendShiftCloseNotification: jest.fn(() => Promise.resolve()),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

describe('/api/dashboard/staff/[id]/shift/close', () => {
    const staffId = '11111111-2222-3333-4444-555555555555';
    const bizId = 'biz-uuid-1111-2222-3333-444444444444';
    const shiftDate = '2024-01-15';

    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockAdmin,
            userId: 'owner-user-id',
            bizId,
        });
        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидном формате даты в query', async () => {
            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=invalid`,
                {
                    method: 'POST',
                    body: { totalAmount: 0, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при отрицательной totalAmount', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: -100, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Права доступа и принадлежность сотрудника', () => {
        test('должен вернуть 404 если сотрудник не найден', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: 0, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 404);
        });

        test('должен вернуть 403 если сотрудник принадлежит другому бизнесу', async () => {
            const otherBizId = 'other-biz-id';
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: otherBizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: 0, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 403);
        });
    });

    describe('Бизнес-логика смены', () => {
        test('должен вернуть 400 если смена на выбранную дату не открыта', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: 1000, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 если смена уже закрыта', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-1',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: shiftDate,
                        status: 'closed',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: '2024-01-15T18:00:00Z',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: 1000, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное закрытие смены', () => {
        test('должен успешно закрыть смену сотрудника от имени владельца (totalAmount, без items)', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-1',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: shiftDate,
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: null,
                        total_amount: null,
                        consumables_amount: null,
                        percent_master: 60,
                        percent_salon: 40,
                        master_share: null,
                        salon_share: null,
                        hours_worked: null,
                        hourly_rate: 100,
                        guaranteed_amount: null,
                        topup_amount: null,
                    },
                    error: null,
                }),
            });

            mockAdmin.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    shift: {
                        id: 'shift-1',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: shiftDate,
                        status: 'closed',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: '2024-01-16T00:00:00Z',
                        total_amount: 1000,
                        consumables_amount: 0,
                        master_share: 600,
                        salon_share: 400,
                    },
                },
                error: null,
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: { totalAmount: 1000, consumablesAmount: 0, items: [] },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            const data = await expectSuccessResponse(res, 200);

            expect(data.ok).toBe(true);
            expect(data.data).toHaveProperty('shift');
            expect(data.data.shift.status).toBe('closed');
            expect(mockAdmin.rpc).toHaveBeenCalledWith(
                'close_staff_shift_safe',
                expect.objectContaining({
                    p_shift_id: 'shift-1',
                    p_total_amount: 1000,
                })
            );
        });

        test('должен успешно закрыть смену с переданными items', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Staff', percent_master: 60, percent_salon: 40, hourly_rate: 100, user_id: 'u1' },
                    error: null,
                }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-1',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: shiftDate,
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: null,
                        total_amount: null,
                        consumables_amount: null,
                        percent_master: 60,
                        percent_salon: 40,
                        master_share: null,
                        salon_share: null,
                        hours_worked: null,
                        hourly_rate: 100,
                        guaranteed_amount: null,
                        topup_amount: null,
                    },
                    error: null,
                }),
            });

            mockAdmin.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    shift: {
                        id: 'shift-1',
                        status: 'closed',
                        total_amount: 1500,
                        master_share: 900,
                        salon_share: 600,
                    },
                },
                error: null,
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/shift/close?date=${shiftDate}`,
                {
                    method: 'POST',
                    body: {
                        items: [
                            { clientName: 'Client 1', serviceName: 'Haircut', serviceAmount: 1000, consumablesAmount: 100, bookingId: null },
                        ],
                    },
                }
            );

            const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
            const data = await expectSuccessResponse(res, 200);

            expect(data.ok).toBe(true);
            expect(data.data.shift.status).toBe('closed');
        });
    });
});
