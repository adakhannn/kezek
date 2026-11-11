import type { SupabaseClient } from '@supabase/supabase-js';

import {
    buildFinanceResponsePayload,
    getShiftData,
} from '@/app/staff/finance/services/shiftDataService';
import { logDebug, logError } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readScheduledDay } from '@/lib/scheduling/read';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: jest.fn() }));
jest.mock('@/lib/scheduling/read', () => ({ readScheduledDay: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

type ReadResult = { data: unknown; error: { message?: string } | null };
type Read = { table: string; methods: Array<[string, ...unknown[]]> };

// Only read-shaped, in-memory thenables. No SDK client or network request is created.
function makeClient(responses: Record<string, ReadResult> = {}) {
    const reads: Read[] = [];
    const defaults: Record<string, ReadResult> = {
        'staff:single': { data: { percent_master: 60, percent_salon: 40, hourly_rate: null }, error: null },
        'working_hours:single': { data: { intervals: [{ start: '09:00', end: '18:00' }] }, error: null },
    };
    const client = {
        rpc: jest.fn(async (name: string, args: Record<string, string>) => {
            if (name === 'read_staff_finance_calendar') {
                const date = args.p_date ?? (args.p_instant ?? today.toISOString()).slice(0,10);
                const dayStart = new Date(date + 'T00:00:00+06:00');
                return responses.calendar ?? { data: { date, todayDate: '2026-10-18', timezone: 'Asia/Bishkek', dayStart: dayStart.toISOString(), dayEnd: new Date(+dayStart + 86400000).toISOString(), dayHours: 24 }, error: null };
            }
            return name === 'read_staff_shift_snapshot' ? (responses['staff_shifts:single'] ?? { data: null, error: null }) : (responses['staff_shifts:list'] ?? { data: [], error: null });
        }),
        from: jest.fn((table: string) => {
            let single = false;
            const read: Read = { table, methods: [] };
            reads.push(read);
            const builder: Record<string, unknown> = {};
            for (const method of ['select', 'eq', 'gte', 'lt', 'lte', 'neq', 'order', 'is']) {
                builder[method] = jest.fn((...args: unknown[]) => {
                    read.methods.push([method, ...args]);
                    return builder;
                });
            }
            builder.maybeSingle = jest.fn(() => { single = true; return builder; });
            builder.then = (
                resolve: (result: ReadResult) => unknown,
                reject?: (reason: unknown) => unknown,
            ) => Promise.resolve(
                responses[table + (single ? ':single' : ':list')]
                ?? defaults[table + (single ? ':single' : ':list')]
                ?? { data: single ? null : [], error: null },
            ).then(resolve, reject);
            return builder;
        }),
    };
    return { client: client as unknown as SupabaseClient, reads };
}

const today = new Date('2026-10-18T06:00:00Z');
const options = { staffId: 'staff-unit', bizId: 'biz-unit', targetDate: today };
const saved = {
    id: 'shift-unit', shift_date: '2026-10-18', status: 'closed',
    ledger_revision: 21,
    opened_at: '2026-10-18T04:00:00Z', closed_at: '2026-10-18T06:00:00Z',
    expected_start: null, late_minutes: 0, total_amount: 600, consumables_amount: 50,
    master_share: 360, salon_share: 50, percent_master: 60, percent_salon: 40,
    hours_worked: 2, hourly_rate: 300, guaranteed_amount: 600, topup_amount: 240,
};

beforeEach(() => {
    jest.clearAllMocks();
    (explicitSchedulingEnabled as jest.Mock).mockReturnValue(false);
    (readScheduledDay as jest.Mock).mockReset();
    (getServiceClient as jest.Mock).mockReset();
    jest.useFakeTimers().setSystemTime(today);
});

afterEach(() => jest.useRealTimers());

test('historical reads skip today-only schedule and aggregate queries', async () => {
    const { client, reads } = makeClient();
    const result = await getShiftData({ ...options, supabase: client,
        targetDate: new Date('2026-10-13T06:00:00Z') });
    expect(result.today).toEqual({ exists: false, status: 'none', shift: null, items: [] });
    expect(result.stats).toBeUndefined();
    expect(result.allShifts).toEqual([]);
    expect(reads.map(read => read.table)).toEqual(['staff', 'bookings', 'service_staff']);
});

test.each(['broken read', undefined])('shift read failure is rejected, not displayed as an empty shift: %s', async message => {
    const { client } = makeClient({ 'staff_shifts:single': { data: null, error: { message } } });
    await expect(getShiftData({ ...options, supabase: client }))
        .rejects.toThrow('Failed to load shift: ' + (message ?? 'Unknown error'));
    expect(logError).toHaveBeenCalledWith('ShiftDataService', 'Error loading shift', { message });
});

test('history dependency errors reject the finance payload instead of returning partial totals', async () => {
    const { client } = makeClient({ 'staff_shifts:list': { data: null, error: { message: 'history unavailable' } } });
    await expect(getShiftData({ ...options, supabase: client })).rejects.toThrow('history unavailable');
});

test('optional display reads retain their fallbacks when financial reads succeed', async () => {
    const error = { message: 'optional unavailable' };
    const { client } = makeClient({ 'staff:single': { data: null, error }, 'bookings:list': { data: null, error }, 'service_staff:list': { data: null, error } });
    const result = await getShiftData({ ...options, supabase: client });
    expect(result).toMatchObject({ staffPercentMaster: 60, staffPercentSalon: 40, bookings: [], services: [], allShifts: [], stats: { totalAmount: 0, shiftsCount: 0 } });
    expect(logError).toHaveBeenCalledTimes(3);
});

test('unavailable optional service client falls back only to the supplied in-memory client', async () => {
    (getServiceClient as jest.Mock).mockImplementation(() => { throw new Error('disabled in unit test'); });
    const { client, reads } = makeClient();
    const result = await getShiftData({ ...options, supabase: client, useServiceClient: true });
    expect(getServiceClient).toHaveBeenCalledTimes(1);
    expect(reads.length).toBe(6);
    expect(result.today.exists).toBe(false);
    expect(logDebug).toHaveBeenCalledWith('ShiftDataService',
        'Failed to create service client, falling back to provided supabase client', expect.any(Error));
});

const dayOffCases: Array<{ name: string; responses: Record<string, ReadResult>; expected: boolean }> = [
    { name: 'time off', responses: { 'staff_time_off:list': { data: [{ id: 'off-unit' }], error: null } }, expected: true },
    { name: 'empty date override', responses: { 'staff_schedule_rules:single': { data: { is_active: true, intervals: [] }, error: null } }, expected: true },
    { name: 'working date override', responses: { 'staff_schedule_rules:single': { data: { is_active: true, intervals: [{ start: '10:00', end: '12:00' }] }, error: null } }, expected: false },
    { name: 'missing weekly hours', responses: { 'working_hours:single': { data: null, error: null } }, expected: true },
    { name: 'malformed weekly hours', responses: { 'working_hours:single': { data: { intervals: 'invalid' }, error: null } }, expected: true },
];

test.each(dayOffCases)('legacy day-off read: $name', async ({ responses, expected }) => {
    const { client } = makeClient(responses);
    expect((await getShiftData({ ...options, supabase: client })).isDayOff).toBe(expected);
});

test.each([{ intervals: [] }, { intervals: [{ start: '09:00', end: '18:00' }] }])('explicit scheduled day owns day-off projection: %j', async ({ intervals }) => {
    (explicitSchedulingEnabled as jest.Mock).mockReturnValue(true);
    (readScheduledDay as jest.Mock).mockResolvedValue({
        ymd: '2026-10-18', day: { tz: 'Asia/Bishkek', intervals },
    });
    const { client } = makeClient();
    const result = await getShiftData({ ...options, supabase: client });
    expect(readScheduledDay).toHaveBeenCalledWith('staff-unit', 'biz-unit', '2026-10-18');
    expect(result.isDayOff).toBe(intervals.length === 0);
});

test('joined service shapes are normalized without mutating or recreating bookings', async () => {
    const service = { name_ru: 'A', name_ky: 'KY A', name_en: 'EN A' };
    const base = { id: 'booking-unit', client_name: null, client_phone: null, start_at: today.toISOString() };
    const { client, reads } = makeClient({
        'bookings:list': { data: [
            { ...base, services: [{ name_ru: '' }, service], booking_services: [{ service }, { service: null }] },
            { ...base, id: 'extra-only', services: null, booking_services: [{ service: { name_ru: 'B' } }] },
            { ...base, id: 'object', services: { name_ru: 'C' }, booking_services: null },
            { ...base, id: 'missing', services: null, booking_services: null },
        ], error: null },
        'service_staff:list': { data: [{ services: [service] }, { services: { name_ru: 'B' } },
            { services: null }, { services: [] }], error: null },
    });
    const result = await getShiftData({ ...options, supabase: client });
    expect(result.bookings.map(row => [row.id, row.services])).toEqual([
        ['booking-unit', service], ['extra-only', { name_ru: 'B', name_ky: null, name_en: null }],
        ['object', { name_ru: 'C', name_ky: null, name_en: null }], ['missing', null],
    ]);
    expect(result.services).toEqual([service, { name_ru: 'B', name_ky: null, name_en: null }]);
    expect(reads.find(read => read.table === 'bookings')?.methods).toEqual(expect.arrayContaining([
        ['eq', 'staff_id', 'staff-unit'], ['neq', 'status', 'cancelled'],
    ]));
});

test('open shift hours and joined-item order are read projections; payload preserves item identity', async () => {
    const item = { client_name: '', service_name: '', service_amount: 0, consumables_amount: 0,
        note: null, booking_id: null, created_at: '2026-10-18T04:00:00Z' };
    const { client, reads } = makeClient({
        'staff:single': { data: { percent_master: 60, percent_salon: 40, hourly_rate: 300 }, error: null },
        'staff_shifts:single': { data: { ...saved, status: 'open', closed_at: null,
            staff_shift_items: [{ ...item, id: 'a' }, { ...item, id: 'b' },
                { ...item, id: 'recent', created_at: '2026-10-18T05:00:00Z' }] }, error: null },
    });
    const result = await getShiftData({ ...options, supabase: client });
    expect(result.currentHoursWorked).toBe(2);
    expect(result.currentGuaranteedAmount).toBe(600);
    expect(result.today.items.map(row => row.id)).toEqual(['recent', 'b', 'a']);
    expect(buildFinanceResponsePayload(result).today.shift?.ledger_revision).toBe(21);
    expect(client.rpc).toHaveBeenCalledWith('read_staff_shift_snapshot', { p_biz_id: 'biz-unit', p_staff_id: 'staff-unit', p_shift_date: '2026-10-18' });
    expect(reads.some(read => read.table === 'staff_shift_items')).toBe(false);
    expect(buildFinanceResponsePayload(result).today.items[1]).toEqual({
        id: 'b', clientName: '', serviceName: '', serviceAmount: 0, consumablesAmount: 0,
        bookingId: null, createdAt: item.created_at,
    });
});

test('nullable closed aggregates default to zero, exclude open rows, and retain final business share', async () => {
    const { client } = makeClient({
        'staff:single': { data: { percent_master: null, percent_salon: null, hourly_rate: 0 }, error: null },
        'staff_shifts:list': { data: [
            { shift_date: '2026-10-01', status: 'closed', total_amount: null, master_share: null,
                salon_share: null, late_minutes: null, guaranteed_amount: null, topup_amount: null },
            { ...saved, shift_date: '2026-10-18T00:00:00Z' },
            { ...saved, status: 'open', total_amount: 999, salon_share: 999 },
        ], error: null },
    });
    const result = await getShiftData({ ...options, supabase: client });
    expect(result.hourlyRate).toBeNull();
    expect(result.allShifts[0]).toEqual({
        shift_date: '2026-10-01', status: 'closed', total_amount: 0, master_share: 0, salon_share: 0,
        late_minutes: 0, guaranteed_amount: 0, topup_amount: 0,
    });
    expect(result.stats).toEqual({
        totalAmount: 600, totalMaster: 360, totalSalon: 50, totalLateMinutes: 0, shiftsCount: 2,
    });
});

test('missing ledger in a successful transport response rejects rather than acknowledging an empty draft', async () => {
    const { client } = makeClient({ 'staff_shifts:single': { data: saved, error: null } });
    await expect(getShiftData({ ...options, supabase: client })).rejects.toThrow('Incomplete shift ledger snapshot');
});


test('literal business day and SQL DST UTC bounds are retained, including the next-midnight exclusive boundary', async () => {
    const calendar = { date: '2026-11-01', todayDate: '2026-11-10', timezone: 'America/New_York', dayStart: '2026-11-01T04:00:00Z', dayEnd: '2026-11-02T05:00:00Z', dayHours: 25 };
    const { client, reads } = makeClient({ calendar: { data: calendar, error: null } });
    const result = await getShiftData({ ...options, targetDate: '2026-11-01', supabase: client });
    expect(client.rpc).toHaveBeenCalledWith('read_staff_finance_calendar', expect.objectContaining({ p_date: '2026-11-01', p_instant: null }));
    expect(result.calendar).toEqual(calendar);
    expect(reads.find(read => read.table === 'bookings')?.methods).toEqual(expect.arrayContaining([['gte','start_at',calendar.dayStart], ['lt','start_at',calendar.dayEnd]]));
});
test('calendar dependency failure cannot fall back to the server timezone', async () => {
    const { client } = makeClient({ calendar: { data: null, error: { message: 'calendar offline' } } });
    await expect(getShiftData({ ...options, supabase: client })).rejects.toThrow('calendar offline');
    expect(client.from).not.toHaveBeenCalled();
});


test('historical open preview stops hourly guarantee at that business day end', async () => {
    const calendar = { date: '2026-11-01', todayDate: '2026-11-10', timezone: 'America/New_York', dayStart: '2026-11-01T04:00:00Z', dayEnd: '2026-11-02T05:00:00Z', dayHours: 25 };
    jest.setSystemTime(new Date('2026-11-10T12:00Z'));
    const { client } = makeClient({ calendar: { data: calendar, error: null }, 'staff:single': { data: { percent_master: 60, percent_salon: 40, hourly_rate: 100 }, error: null },
        'staff_shifts:single': { data: { ...saved, status: 'open', shift_date: calendar.date, opened_at: calendar.dayStart, staff_shift_items: [] }, error: null } });
    const result = await getShiftData({ ...options, targetDate: calendar.date, supabase: client });
    expect(result.currentHoursWorked).toBe(25); expect(result.currentGuaranteedAmount).toBe(2500);
});
