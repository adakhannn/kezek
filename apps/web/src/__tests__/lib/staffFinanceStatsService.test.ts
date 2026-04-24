import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';

describe('staffFinanceStatsService', () => {
    const fixedNow = new Date('2024-01-15T10:00:00.000Z');
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(fixedNow);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns validation failure for impossible date', async () => {
        const result = await runStaffFinanceStats({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/finance/stats?period=day&date=2024-02-30'),
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: { full_name: 'Test Staff' },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверная дата (например, 30 февраля)',
        });
    });

    test('returns month stats with open shift merged into results', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'open-shift',
                        shift_date: '2024-01-15',
                        status: 'open',
                        total_amount: 0,
                        master_share: 0,
                        salon_share: 0,
                        consumables_amount: 0,
                        late_minutes: 0,
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 500,
                        guaranteed_amount: 0,
                        hours_worked: null,
                        opened_at: '2024-01-15T09:00:00.000Z',
                        closed_at: null,
                        staff: {
                            hourly_rate: 500,
                            percent_master: 60,
                            percent_salon: 40,
                        },
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

        const result = await runStaffFinanceStats({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/finance/stats?period=month&date=2024-01'),
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: { full_name: 'Test Staff' },
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.stats).toMatchObject({
                period: 'month',
                openShiftsCount: 1,
                shiftsCount: 1,
            });
        }
    });
});

