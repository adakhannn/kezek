import { initializeStaffSchedule } from '@/lib/staffSchedule';

jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));

type Result = { data: unknown; error: { message: string } | null };

function adminWith(branch: Result) {
    const inserted: Array<Array<{ date_on: string; intervals: unknown[] }>> = [];
    const chain = (result: Result) => {
        const self: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'gte', 'lt']) self[method] = () => self;
        self.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
        return self;
    };
    const admin = {
        from: (table: string) => {
            if (table === 'branch_working_hours') return chain(branch);
            return {
                ...chain({ data: [], error: null }),
                insert: (rows: Array<{ date_on: string; intervals: unknown[] }>) => {
                    inserted.push(rows);
                    return chain({ data: rows.map((_, index) => ({ id: String(index) })), error: null });
                },
            };
        },
    };
    return { admin: admin as never, inserted };
}

describe('initializeStaffSchedule (FE-02)', () => {
    beforeEach(() => {
        jest.useFakeTimers({ now: new Date('2026-11-18T06:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'queueMicrotask'] });
    });
    afterEach(() => jest.useRealTimers());

    test('writes days from today by branch hours; closed branch days become days off', async () => {
        const { admin, inserted } = adminWith({
            data: [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, intervals: [{ start: '10:00', end: '19:00' }] }))
                .concat([{ day_of_week: 6, intervals: [] }]),
            error: null,
        });

        const result = await initializeStaffSchedule(admin, 'biz-1', 'staff-1', 'branch-1');

        expect(result).toEqual({ success: true, daysCreated: 12 });
        const byDate = new Map(inserted[0].map((row) => [row.date_on, row.intervals]));
        expect(byDate.has('2026-11-17')).toBe(false);
        expect(byDate.get('2026-11-18')).toEqual([{ start: '10:00', end: '19:00' }]);
        expect(byDate.get('2026-11-21')).toEqual([]);
        expect(byDate.get('2026-11-22')).toEqual([]);
    });

    test('a branch without any hours keeps the documented 09:00-21:00 default', async () => {
        const { admin, inserted } = adminWith({ data: [], error: null });

        await initializeStaffSchedule(admin, 'biz-1', 'staff-1', 'branch-1');

        expect(inserted[0].every((row) => JSON.stringify(row.intervals) === JSON.stringify([{ start: '09:00', end: '21:00' }]))).toBe(true);
    });

    test('an unreadable branch schedule writes nothing', async () => {
        const { admin, inserted } = adminWith({ data: null, error: { message: 'timeout' } });

        const result = await initializeStaffSchedule(admin, 'biz-1', 'staff-1', 'branch-1');

        expect(result.success).toBe(false);
        expect(inserted).toEqual([]);
    });
});
