jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffShiftTodayService', () => ({
    runStaffShiftToday: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

import { getStaffContext } from '@/lib/authBiz';
import { logWarn } from '@/lib/log';
import { runStaffShiftToday } from '@/lib/staffShiftTodayService';

describe('staffShiftTodayHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: {},
            staffId: 'staff-1',
            bizId: 'biz-1',
        });
    });

    test('logs deprecation and returns success response', async () => {
        (runStaffShiftToday as jest.Mock).mockResolvedValue({
            ok: true,
            data: { today: { exists: false } },
        });
        const { runStaffShiftTodayHttp } = await import('@/lib/staffShiftTodayHttpService');

        const response = await runStaffShiftTodayHttp();
        const body = await response.json();

        expect(logWarn).toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(body.data.today.exists).toBe(false);
    });
});
