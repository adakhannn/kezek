/**
 * Тесты для /api/bookings/[id]/mark-attendance
 * Критичная операция: применение промо при отметке посещения
 */

import { POST } from '@/app/api/bookings/[id]/mark-attendance/route';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {},
}));

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((operation, fn) => fn()),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

describe('/api/bookings/[id]/mark-attendance', () => {
    const mockAdmin = {
        from: jest.fn(() => mockAdmin),
        select: jest.fn(() => mockAdmin),
        eq: jest.fn(() => mockAdmin),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId: 'test-biz-id',
        });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamUuid as jest.Mock).mockResolvedValue('test-booking-id');
    });

    describe('Edge cases', () => {
        test('должен применить промо при отметке посещения (attended = true)', async () => {
            // Настройка моков
            mockAdmin.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'test-booking-id',
                    biz_id: 'test-biz-id',
                    start_at: new Date(Date.now() - 86400000).toISOString(), // вчера
                    status: 'confirmed',
                },
                error: null,
            });

            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: null,
            });

            const req = new Request('http://localhost/api/bookings/test-booking-id/mark-attendance', {
                method: 'POST',
                body: JSON.stringify({ attended: true }),
            });

            const response = await POST(req, { params: { id: 'test-booking-id' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.status).toBe('paid');
            // Проверяем, что была вызвана функция с применением промо
            expect(mockAdmin.rpc).toHaveBeenCalledWith(
                'update_booking_status_with_promotion',
                expect.objectContaining({
                    p_booking_id: 'test-booking-id',
                    p_new_status: 'paid',
                })
            );
        });

        test('должен обработать отметку "не пришел" (attended = false)', async () => {
            mockAdmin.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'test-booking-id',
                    biz_id: 'test-biz-id',
                    start_at: new Date(Date.now() - 86400000).toISOString(),
                    status: 'confirmed',
                },
                error: null,
            });

            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: null,
            });

            const req = new Request('http://localhost/api/bookings/test-booking-id/mark-attendance', {
                method: 'POST',
                body: JSON.stringify({ attended: false }),
            });

            const response = await POST(req, { params: { id: 'test-booking-id' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.status).toBe('no_show');
            // Проверяем, что была вызвана функция без промо
            expect(mockAdmin.rpc).toHaveBeenCalledWith(
                'update_booking_status_no_check',
                expect.objectContaining({
                    p_booking_id: 'test-booking-id',
                    p_new_status: 'no_show',
                })
            );
        });

        test('должен отклонить отметку для будущей брони', async () => {
            mockAdmin.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'test-booking-id',
                    biz_id: 'test-biz-id',
                    start_at: new Date(Date.now() + 86400000).toISOString(), // завтра
                    status: 'confirmed',
                },
                error: null,
            });

            const req = new Request('http://localhost/api/bookings/test-booking-id/mark-attendance', {
                method: 'POST',
                body: JSON.stringify({ attended: true }),
            });

            const response = await POST(req, { params: { id: 'test-booking-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.message).toContain('прошедших');
        });

        test('должен вернуть успех для уже обработанной брони (paid/no_show)', async () => {
            mockAdmin.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'test-booking-id',
                    biz_id: 'test-biz-id',
                    start_at: new Date(Date.now() - 86400000).toISOString(),
                    status: 'paid', // уже обработана
                },
                error: null,
            });

            const req = new Request('http://localhost/api/bookings/test-booking-id/mark-attendance', {
                method: 'POST',
                body: JSON.stringify({ attended: true }),
            });

            const response = await POST(req, { params: { id: 'test-booking-id' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.status).toBe('paid');
            // Проверяем, что RPC не был вызван повторно
            expect(mockAdmin.rpc).not.toHaveBeenCalled();
        });

        test('должен отклонить запрос для брони другого бизнеса', async () => {
            mockAdmin.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'test-booking-id',
                    biz_id: 'other-biz-id', // другой бизнес
                    start_at: new Date(Date.now() - 86400000).toISOString(),
                    status: 'confirmed',
                },
                error: null,
            });

            const req = new Request('http://localhost/api/bookings/test-booking-id/mark-attendance', {
                method: 'POST',
                body: JSON.stringify({ attended: true }),
            });

            const response = await POST(req, { params: { id: 'test-booking-id' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.ok).toBe(false);
        });
    });
});

