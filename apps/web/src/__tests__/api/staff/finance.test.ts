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
            expect(data.data.shift).toBeDefined();
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
            expect(data.error).toContain('Invalid date format');
        });
    });

    describe('Для менеджера (с staffId)', () => {
        test('должен вернуть данные смены для указанного сотрудника', async () => {
            (getBizContextForManagers as jest.Mock).mockResolvedValue({
                supabase: mockSupabase,
                bizId: 'test-biz-id',
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

            const req = new Request('http://localhost/api/staff/finance?staffId=target-staff-id&date=2024-01-26', {
                method: 'GET',
            });

            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(getBizContextForManagers).toHaveBeenCalled();
            expect(getShiftData).toHaveBeenCalledWith(
                expect.objectContaining({
                    staffId: 'target-staff-id',
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

            expect(response.status).toBe(500);
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

