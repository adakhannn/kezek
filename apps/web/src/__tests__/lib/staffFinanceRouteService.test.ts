jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/app/staff/finance/services/shiftDataService', () => ({
    getShiftData: jest.fn(),
    buildFinanceResponsePayload: jest.fn((result) => ({
        today: result.today,
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

import { getBizContextForManagers, getStaffContextForRequest } from '@/lib/authBiz';
import { getShiftData } from '@/app/staff/finance/services/shiftDataService';
import { runStaffFinanceRoute } from '@/lib/staffFinanceRouteService';

describe('staffFinanceRouteService', () => {
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
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation failure for invalid query', async () => {
        const req = new Request('http://localhost/api/staff/finance?date=invalid-date');

        const result = await runStaffFinanceRoute(req);

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid query parameters',
            metric: {
                statusCode: 400,
            },
        });
    });

    test('returns success for staff self request', async () => {
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'staff-id',
            bizId: 'biz-id',
        });

        (getShiftData as jest.Mock).mockResolvedValue({
            today: { exists: false, status: 'none', shift: null, items: [] },
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

        const req = new Request('http://localhost/api/staff/finance');
        const result = await runStaffFinanceRoute(req);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.metric.staffId).toBe('staff-id');
            expect(result.metric.bizId).toBe('biz-id');
        }
    });

    test('returns not_found for manager request with mismatched business', async () => {
        const staffId = '123e4567-e89b-42d3-a456-426614174000';
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId: 'biz-id',
        });
        mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: 'other-biz-id',
            },
            error: null,
        });

        const req = new Request(`http://localhost/api/staff/finance?staffId=${staffId}`);
        const result = await runStaffFinanceRoute(req);

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Сотрудник не найден или доступ запрещен',
            metric: {
                statusCode: 404,
                staffId,
                bizId: 'biz-id',
                date: null,
                useServiceClient: true,
            },
        });
    });
});
