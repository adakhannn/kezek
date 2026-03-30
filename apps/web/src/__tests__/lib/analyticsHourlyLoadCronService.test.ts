import { recalcHourlyForDate } from '@/lib/analyticsHourlyLoadCronService';

describe('analyticsHourlyLoadCronService', () => {
    test('returns zero when no successful bookings exist for the date', async () => {
        const supabase = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    gte: jest.fn().mockReturnValue({
                        lte: jest.fn().mockReturnValue({
                            in: jest.fn().mockResolvedValue({
                                data: [],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        };

        const result = await recalcHourlyForDate({
            supabase: supabase as never,
            dateStr: '2026-03-27',
        });

        expect(result).toEqual({
            date: '2026-03-27',
            updated: 0,
        });
    });
});
