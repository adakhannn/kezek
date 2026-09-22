import { emptyWeek, validatePublishSchedule, validDate } from '@/lib/scheduling/model';

const command = () => ({ kind: 'week' as const, from: '2026-09-28', branchId: '00000000-0000-0000-0000-000000000001', expectedRevision: 0, days: emptyWeek() });
describe('explicit schedule contract', () => {
    test('an explicit week of days off is valid; no hours are invented', () => {
        const input = command(); expect(() => validatePublishSchedule(input)).not.toThrow();
        expect(input.days['1'].intervals).toEqual([]);
    });
    test('all weekdays are mandatory', () => {
        const input = command(); delete input.days['7']; expect(() => validatePublishSchedule(input)).toThrow();
    });
    test('multiple intervals and contained breaks survive validation unchanged', () => {
        const input = command();
        input.days['1'] = { intervals: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }], breaks: [{ start: '10:00', end: '10:15' }] };
        const before = JSON.stringify(input); validatePublishSchedule(input); expect(JSON.stringify(input)).toBe(before);
    });
    test.each([
        [{ start: '18:00', end: '09:00' }], [{ start: '09:00', end: '09:00' }],
        [{ start: '09:00', end: '26:00' }], [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '18:00' }],
    ])('rejects invalid intervals %p', (...ranges) => {
        const input = command(); input.days['1'].intervals = ranges;
        expect(() => validatePublishSchedule(input)).toThrow();
    });
    test('a break cannot exist on a day off', () => {
        const input = command(); input.days['1'].breaks = [{ start: '13:00', end: '14:00' }];
        expect(() => validatePublishSchedule(input)).toThrow();
    });
    test('invalid calendar dates are rejected', () => {
        expect(validDate('2026-02-30')).toBe(false); expect(validDate('2028-02-29')).toBe(true);
    });
    test('day override and revision are validated', () => {
        const input = { ...command(), kind: 'day', days: { day: { intervals: [], breaks: [] } } };
        expect(() => validatePublishSchedule(input)).not.toThrow();
        expect(() => validatePublishSchedule({ ...input, expectedRevision: -1 })).toThrow();
    });
});
