import {
    listManagedBusinesses,
    listManagerBookings,
    managerBookingsWindow,
    parseManagerBookingsQuery,
} from '@/lib/mobileManagerService';
import { listManagedBusinessRoles, managerAccessToBusiness } from '@/lib/businessManagerAccess';

jest.mock('@/lib/businessManagerAccess', () => ({
    listManagedBusinessRoles: jest.fn(),
    managerAccessToBusiness: jest.fn(),
}));

type Result = { data: unknown; error: unknown };
const BIZ = '00000000-0000-4000-8000-000000000001';

function fakeAdmin(results: Record<string, Result>) {
    const calls: Array<{ table: string; filters: unknown[][] }> = [];
    const from = jest.fn((table: string) => {
        const call = { table, filters: [] as unknown[][] };
        calls.push(call);
        const builder: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'gte', 'lt', 'in', 'order', 'range']) {
            builder[method] = (...args: unknown[]) => { call.filters.push([method, ...args]); return builder; };
        }
        builder.maybeSingle = () => Promise.resolve(results[table] ?? { data: null, error: null });
        builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject);
        return builder;
    });
    return { admin: { from } as never, calls };
}

const row = (id: string, values: Record<string, unknown> = {}) => ({
    id, status: 'confirmed', start_at: '2026-11-26T05:00:00Z', end_at: '2026-11-26T05:30:00Z',
    client_id: null, client_name: 'Client', client_phone: '+996555000111',
    service: { name_ru: 'Стрижка', name_ky: null, name_en: 'Haircut' }, staff: { full_name: 'Master' }, branch: { name: 'Center' },
    ...values,
});

beforeEach(() => jest.clearAllMocks());

describe('parseManagerBookingsQuery', () => {
    test('requires a business UUID and a known scope; limit and offset are bounded', () => {
        expect(parseManagerBookingsQuery(new URLSearchParams(`bizId=${BIZ}&scope=today`))).toEqual({ bizId: BIZ, scope: 'today', limit: 30, offset: 0 });
        expect(parseManagerBookingsQuery(new URLSearchParams(`bizId=${BIZ}&scope=upcoming&limit=10&offset=20`))).toEqual({ bizId: BIZ, scope: 'upcoming', limit: 10, offset: 20 });
        expect(parseManagerBookingsQuery(new URLSearchParams(`bizId=${BIZ}&scope=upcoming&limit=500&offset=-1`))).toEqual({ bizId: BIZ, scope: 'upcoming', limit: 30, offset: 0 });
        expect(parseManagerBookingsQuery(new URLSearchParams('bizId=not-a-uuid&scope=today'))).toBeNull();
        expect(parseManagerBookingsQuery(new URLSearchParams(`bizId=${BIZ}&scope=past`))).toBeNull();
    });
});

describe('managerBookingsWindow', () => {
    test('today and after today are business-local days, whatever zone the server runs in', () => {
        // 23:30 UTC on 25 Nov is already 26 Nov in Bishkek (UTC+6).
        const now = new Date('2026-11-25T23:30:00Z');
        expect(managerBookingsWindow('today', 'Asia/Bishkek', now)).toEqual({ from: '2026-11-25T18:00:00.000Z', before: '2026-11-26T18:00:00.000Z' });
        expect(managerBookingsWindow('upcoming', 'Asia/Bishkek', now)).toEqual({ from: '2026-11-26T18:00:00.000Z', before: null });
    });
});

describe('listManagedBusinesses', () => {
    test('the managed businesses with the caller\'s role and a valid time zone', async () => {
        jest.mocked(listManagedBusinessRoles).mockResolvedValue(new Map([['biz-1', 'owner'], ['biz-2', 'admin']]));
        const { admin, calls } = fakeAdmin({ businesses: { data: [
            { id: 'biz-2', name: 'A', slug: 'a', address: null, phones: null, tz: 'Bad/Zone' },
            { id: 'biz-1', name: 'B', slug: 'b', address: 'Street', phones: ['+996'], tz: 'Asia/Almaty' },
        ], error: null } });
        const result = await listManagedBusinesses({ admin, userId: 'user-1' });
        expect(result).toEqual({ ok: true, data: [
            { id: 'biz-2', name: 'A', slug: 'a', address: null, phones: null, tz: 'Asia/Bishkek', role: 'admin' },
            { id: 'biz-1', name: 'B', slug: 'b', address: 'Street', phones: ['+996'], tz: 'Asia/Almaty', role: 'owner' },
        ] });
        expect(calls[0].filters).toContainEqual(['in', 'id', ['biz-1', 'biz-2']]);
    });

    test('managing nothing reads no businesses', async () => {
        jest.mocked(listManagedBusinessRoles).mockResolvedValue(new Map());
        const { admin, calls } = fakeAdmin({});
        expect(await listManagedBusinesses({ admin, userId: 'user-1' })).toEqual({ ok: true, data: [] });
        expect(calls).toEqual([]);
    });
});

describe('listManagerBookings (O1)', () => {
    const query = { bizId: BIZ, scope: 'today' as const, limit: 2, offset: 0 };

    test.each([['none', 403, 'forbidden'], ['missing', 404, 'not_found']] as const)('access %s: %i, and no booking is read', async (access, status, error) => {
        jest.mocked(managerAccessToBusiness).mockResolvedValue(access);
        const { admin, calls } = fakeAdmin({});
        expect(await listManagerBookings({ admin, userId: 'user-1', query })).toMatchObject({ ok: false, status, error });
        expect(calls.map(call => call.table)).not.toContain('bookings');
    });

    test('today: not-cancelled bookings of the business by start time, one extra row for has_more, profile name fallback', async () => {
        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        const { admin, calls } = fakeAdmin({
            businesses: { data: { tz: 'Asia/Bishkek' }, error: null },
            bookings: { data: [row('b1'), row('b2', { client_name: ' ', client_id: 'client-2', service: [{ name_ru: 'X', name_ky: null, name_en: null }] }), row('b3')], error: null },
            profiles: { data: [{ id: 'client-2', full_name: 'Profile Name' }], error: null },
        });
        const result = await listManagerBookings({ admin, userId: 'user-1', query, now: new Date('2026-11-26T06:00:00Z') });
        expect(managerAccessToBusiness).toHaveBeenCalledWith(admin, 'user-1', BIZ);
        const bookings = calls.find(call => call.table === 'bookings')!.filters;
        expect(bookings).toEqual(expect.arrayContaining([
            ['eq', 'biz_id', BIZ], ['neq', 'status', 'cancelled'],
            ['gte', 'start_at', '2026-11-25T18:00:00.000Z'], ['lt', 'start_at', '2026-11-26T18:00:00.000Z'],
            ['order', 'start_at', { ascending: true }], ['range', 0, 2],
        ]));
        expect(result).toMatchObject({ ok: true, timezone: 'Asia/Bishkek', page: { offset: 0, limit: 2, has_more: true, next_offset: 2 } });
        if (!result.ok) throw new Error('expected success');
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({ id: 'b1', status: 'confirmed', start_at: '2026-11-26T05:00:00Z', end_at: '2026-11-26T05:30:00Z',
            client_name: 'Client', client_phone: '+996555000111', service: { name_ru: 'Стрижка', name_ky: null, name_en: 'Haircut' },
            staff_name: 'Master', branch_name: 'Center' });
        expect(result.data[1]).toMatchObject({ client_name: 'Profile Name', service: { name_ru: 'X' } });
    });

    test('upcoming has no upper bound; the last page has no next offset', async () => {
        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        const { admin, calls } = fakeAdmin({ businesses: { data: { tz: null }, error: null }, bookings: { data: [row('b1')], error: null } });
        const result = await listManagerBookings({ admin, userId: 'user-1', query: { ...query, scope: 'upcoming' }, now: new Date('2026-11-26T06:00:00Z') });
        const bookings = calls.find(call => call.table === 'bookings')!.filters;
        expect(bookings.some(([method]) => method === 'lt')).toBe(false);
        expect(result).toMatchObject({ ok: true, page: { has_more: false, next_offset: null } });
    });

    test('a failed read is an error, never an empty day', async () => {
        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        const { admin } = fakeAdmin({ businesses: { data: { tz: null }, error: null }, bookings: { data: null, error: { message: 'down' } } });
        expect(await listManagerBookings({ admin, userId: 'user-1', query })).toMatchObject({ ok: false, status: 500 });
    });
});
