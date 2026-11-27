import { GET } from '@/app/api/staff/me/time-off/route';

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('GET /api/staff/me/time-off', () => {
    const calls: unknown[][] = [];
    const items = [{ date_from: '2026-11-27', date_to: '2026-11-28' }];

    beforeEach(() => {
        jest.clearAllMocks();
        calls.length = 0;
        const query: Record<string, jest.Mock> = {};
        for (const method of ['select', 'eq', 'is', 'lte', 'gte', 'order']) {
            query[method] = jest.fn((...args: unknown[]) => { calls.push([method, ...args]); return query; });
        }
        query.limit = jest.fn().mockResolvedValue({ data: items, error: null });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn((table: string) => { calls.push(['from', table]); return query; }) });
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ staffId: 'staff-1', bizId: 'biz-1' });
    });

    test('returns the master\'s own active absences overlapping the range, dates only', async () => {
        const response = await GET(new Request('https://kezek.test/api/staff/me/time-off?from=2026-11-23&to=2026-12-06'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.items).toEqual(items);
        expect(calls).toEqual(expect.arrayContaining([
            ['from', 'staff_time_off'],
            ['select', 'date_from,date_to'],
            ['eq', 'staff_id', 'staff-1'],
            ['eq', 'biz_id', 'biz-1'],
            ['is', 'cancelled_at', null],
            ['lte', 'date_from', '2026-12-06'],
            ['gte', 'date_to', '2026-11-23'],
        ]));
    });

    test('rejects a missing or reversed range before reading anything', async () => {
        const response = await GET(new Request('https://kezek.test/api/staff/me/time-off?from=2026-12-06&to=2026-11-23'));

        expect(response.status).toBe(400);
        expect(getStaffContextForRequest).not.toHaveBeenCalled();
    });
});
