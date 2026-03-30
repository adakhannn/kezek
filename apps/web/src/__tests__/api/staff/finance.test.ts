/**
 * Интеграционные тесты для /api/staff/finance
 * Критичный endpoint: получение данных смены для сотрудника и менеджера
 */

import { GET } from '@/app/api/staff/finance/route';

// Мокируем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/app/staff/finance/services/shiftDataService', () => ({
    getShiftData: jest.fn(),
    buildFinanceResponsePayload: jest.fn((result) => ({
        today: {
            ...result.today,
            items: (result.today?.items ?? []).map((item: {
                id: string;
                client_name: string;
                service_name: string;
                service_amount: number;
                consumables_amount: number;
                booking_id?: string | null;
                created_at?: string | null;
            }) => ({
                id: item.id,
                clientName: item.client_name,
                serviceName: item.service_name,
                serviceAmount: item.service_amount,
                consumablesAmount: item.consumables_amount,
                bookingId: item.booking_id ?? null,
                createdAt: item.created_at ?? null,
            })),
        },
        bookings: result.bookings,
        services: result.services,
        allShifts: result.allShifts,
        staffPercentMaster: result.staffPercentMaster,
        staffPercentSalon: result.staffPercentSalon,
        hourlyRate: result.hourlyRate,
        currentHoursWorked: result.currentHoursWorked,
        currentGuaranteedAmount: result.currentGuaranteedAmount,
        isDayOff: result.isDayOff,
        stats: result.stats,
    })),
}));

jest.mock('@/lib/apiMetrics', () => ({
    logApiMetric: jest.fn(() => Promise.resolve()),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    determineErrorType: jest.fn(() => null),
}));

import { getStaffContext, getBizContextForManagers } from '@/lib/authBiz';
import { getShiftData } from '@/app/staff/finance/services/shiftDataService';

describe('/api/staff/finance', () => {
    const mockSupabase = {
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: { user: { id: 'user-id' } },
                error: null,
            }),
        },
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Для сотрудника (без staffId)', () => {
        test('должен вернуть данные смены для текущего сотрудника', async () => {
            (getStaffContext as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                staffId: 'test-staff-id',
                bizId: 'test-biz-id',
            });

            (getShiftData as jest.Mock).mockResolvedValue({
                ok: true,
                today: {
                    exists: true,
                    status: 'open',
                    shift: {
                        id: 'shift-id',
                        shift_date: '2024-01-26',
                        status: 'open',
                        total_amount: 10000,
                        master_share: 6000,
                        salon_share: 4000,
                    },
                    items: [],
                },
                bookings: [],
                services: [],
                staffPercentMaster: 60,
                staffPercentSalon: 40,
                hourlyRate: 500,
                currentHoursWorked: 8,
                currentGuaranteedAmount: 4000,
                isDayOff: false,
                allShifts: [],
            });

            const req = new Request('http://localhost/api/staff/finance?date=2024-01-26', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.today.shift).toBeDefined();
            expect(getStaffContext).toHaveBeenCalled();
        });

        test('должен использовать сегодняшнюю дату, если date не указан', async () => {
            (getStaffContext as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                staffId: 'test-staff-id',
                bizId: 'test-biz-id',
            });

            (getShiftData as jest.Mock).mockResolvedValue({
                ok: true,
                today: {
                    exists: false,
                    status: 'none',
                    shift: null,
                    items: [],
                },
                bookings: [],
                services: [],
                staffPercentMaster: 60,
                staffPercentSalon: 40,
                hourlyRate: null,
                currentHoursWorked: null,
                currentGuaranteedAmount: null,
                isDayOff: false,
                allShifts: [],
            });

            const req = new Request('http://localhost/api/staff/finance', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(getShiftData).toHaveBeenCalled();
        });

        test('должен вернуть ошибку при невалидном формате даты', async () => {
            (getStaffContext as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                staffId: 'test-staff-id',
                bizId: 'test-biz-id',
            });

            const req = new Request('http://localhost/api/staff/finance?date=invalid-date', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toBe('validation');
        });
    });

    describe('Для менеджера (с staffId)', () => {
        test('должен вернуть данные смены для указанного сотрудника', async () => {
            (getBizContextForManagers as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                bizId: 'test-biz-id',
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: '123e4567-e89b-42d3-a456-426614174000',
                        biz_id: 'test-biz-id',
                    },
                    error: null,
                }),
            });

            (getShiftData as jest.Mock).mockResolvedValue({
                ok: true,
                today: {
                    exists: true,
                    status: 'closed',
                    shift: {
                        id: 'shift-id',
                        shift_date: '2024-01-26',
                        status: 'closed',
                        total_amount: 10000,
                        master_share: 6000,
                        salon_share: 4000,
                    },
                    items: [],
                },
                bookings: [],
                services: [],
                staffPercentMaster: 60,
                staffPercentSalon: 40,
                hourlyRate: null,
                currentHoursWorked: null,
                currentGuaranteedAmount: null,
                isDayOff: false,
                allShifts: [],
            });

            const req = new Request('http://localhost/api/staff/finance?staffId=123e4567-e89b-42d3-a456-426614174000&date=2024-01-26', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(getBizContextForManagers).toHaveBeenCalled();
            expect(getShiftData).toHaveBeenCalledWith(
                expect.objectContaining({
                    staffId: '123e4567-e89b-42d3-a456-426614174000',
                })
            );
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть ошибку при отсутствии авторизации', async () => {
            (getStaffContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

            const req = new Request('http://localhost/api/staff/finance', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.ok).toBe(false);
        });

        test('должен вернуть ошибку при ошибке получения данных', async () => {
            (getStaffContext as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                staffId: 'test-staff-id',
                bizId: 'test-biz-id',
            });

            (getShiftData as jest.Mock).mockRejectedValue(new Error('Database error'));

            const req = new Request('http://localhost/api/staff/finance', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
        });
    });
});

