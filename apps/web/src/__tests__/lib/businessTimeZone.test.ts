/**
 * ARCH-11: business-facing times use businesses.tz. Asia/Bishkek is UTC+6, Asia/Almaty UTC+5 (since
 * 1 March 2024) and Europe/Moscow UTC+3, none with DST: the same instant falls on another clock time
 * and, near midnight, on another calendar day.
 */
import { loadBusinessTimeZone } from '@/lib/businessTimeZone';
import { updateBusinessContactSettings } from '@/lib/businessContactSettingsService';
import { formatDateTime, formatTime } from '@/lib/dateFormat';
import { buildShiftCloseEmail } from '@/lib/notifications/shiftNotifications';
import { formatNotificationDate, formatNotificationDateTime, formatNotificationTime } from '@/lib/notifications/notificationText';
import { dateAtTz, dayBoundsInTz, formatDateInTz, getBusinessTimezone, toLabel } from '@/lib/time';
import { businessSettingsPatchSchema } from '@/lib/validation/businessUpdateSchemas';

jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn(() => { throw new Error('no service role in tests'); }) }));

const reader = (result: { data: { tz: string | null } | null; error: { message: string } | null }) => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(result) };
    return { client: { from: jest.fn(() => query) }, query };
};

describe('getBusinessTimezone', () => {
    test.each([
        [null, 'Asia/Bishkek'],
        [undefined, 'Asia/Bishkek'],
        ['', 'Asia/Bishkek'],
        ['Not/AZone', 'Asia/Bishkek'],
        ['Asia/Almaty', 'Asia/Almaty'],
        [' Europe/Moscow ', 'Europe/Moscow'],
    ])('%j -> %s', (tz, expected) => {
        expect(getBusinessTimezone(tz)).toBe(expected);
    });
});

describe('loadBusinessTimeZone', () => {
    test('reads businesses.tz of the business', async () => {
        const { client, query } = reader({ data: { tz: 'Asia/Almaty' }, error: null });
        await expect(loadBusinessTimeZone('biz-1', client as never)).resolves.toBe('Asia/Almaty');
        expect(client.from).toHaveBeenCalledWith('businesses');
        expect(query.select).toHaveBeenCalledWith('tz');
        expect(query.eq).toHaveBeenCalledWith('id', 'biz-1');
    });

    test.each([
        [{ data: { tz: null }, error: null }],
        [{ data: null, error: null }],
        [{ data: null, error: { message: 'boom' } }],
    ])('falls back to Asia/Bishkek: %j', async (result) => {
        const { client } = reader(result);
        await expect(loadBusinessTimeZone('biz-1', client as never)).resolves.toBe('Asia/Bishkek');
    });

    test('a failing service client falls back to Asia/Bishkek', async () => {
        await expect(loadBusinessTimeZone('biz-1')).resolves.toBe('Asia/Bishkek');
    });
});

describe('slots and day boundaries in the business zone', () => {
    test('a business day starts at its own midnight', () => {
        expect(dayBoundsInTz('2026-11-25', 'Asia/Bishkek').start.toISOString()).toBe('2026-11-24T18:00:00.000Z');
        expect(dayBoundsInTz('2026-11-25', 'Asia/Almaty').start.toISOString()).toBe('2026-11-24T19:00:00.000Z');
        expect(dayBoundsInTz('2026-11-25', 'Europe/Moscow')).toEqual({
            start: new Date('2026-11-24T21:00:00.000Z'),
            end: new Date('2026-11-25T21:00:00.000Z'),
        });
    });

    test('a 10:00 slot of the working day is a different instant in each zone', () => {
        expect(dateAtTz('2026-11-25', '10:00', 'Asia/Bishkek').toISOString()).toBe('2026-11-25T04:00:00.000Z');
        expect(dateAtTz('2026-11-25', '10:00', 'Asia/Almaty').toISOString()).toBe('2026-11-25T05:00:00.000Z');
        expect(dateAtTz('2026-11-25', '10:00', 'Europe/Moscow').toISOString()).toBe('2026-11-25T07:00:00.000Z');
    });

    test('the same slot instant is labelled in the business zone', () => {
        const slot = new Date('2026-11-25T05:00:00.000Z');
        expect(toLabel(slot, 'Asia/Bishkek')).toBe('11:00');
        expect(toLabel(slot, 'Asia/Almaty')).toBe('10:00');
        expect(toLabel(slot, 'Europe/Moscow')).toBe('08:00');
    });

    test('"today" near midnight is the business calendar day', () => {
        const lateEvening = new Date('2026-11-25T18:30:00.000Z'); // 00:30 on the 26th in Bishkek
        expect(formatDateInTz(lateEvening, 'Asia/Bishkek')).toBe('2026-11-26');
        expect(formatDateInTz(lateEvening, 'Asia/Almaty')).toBe('2026-11-25');
        expect(formatDateInTz(lateEvening, 'Europe/Moscow')).toBe('2026-11-25');
    });
});

describe('cabinet and staff displays take the zone', () => {
    const start = '2026-11-25T05:00:00.000Z';
    test('dateFormat keeps Bishkek by default and follows a given zone', () => {
        expect(formatTime(start, 'ru')).toBe('11:00');
        expect(formatTime(start, 'ru', 'Asia/Almaty')).toBe('10:00');
        expect(formatDateTime(start, 'ru', true, 'Europe/Moscow')).toBe('25.11.2026 08:00');
        expect(formatDateTime('2026-11-25T19:30:00.000Z', 'ru', true, 'Asia/Bishkek')).toBe('26.11.2026 01:30');
        expect(formatDateTime('2026-11-25T19:30:00.000Z', 'ru', true, 'Asia/Almaty')).toBe('26.11.2026 00:30');
    });
});

describe('notification texts in the business zone', () => {
    const start = '2026-11-25T18:30:00.000Z';
    test('booking time and date follow the business zone', () => {
        expect(formatNotificationDateTime(start, 'Asia/Bishkek', 'ru')).toBe('26.11.2026 00:30');
        expect(formatNotificationDateTime(start, 'Asia/Almaty', 'ru')).toBe('25.11.2026 23:30');
        expect(formatNotificationDateTime(start, 'Europe/Moscow', 'ru')).toBe('25.11.2026 21:30');
        expect(formatNotificationTime(start, 'Asia/Almaty')).toBe('23:30');
    });

    test('a shift date is a calendar day shown as is in every zone', () => {
        for (const tz of ['Asia/Bishkek', 'Asia/Almaty', 'Europe/Moscow', 'America/New_York']) {
            expect(formatNotificationDate('2026-11-20', tz, 'ru')).toBe('20.11.2026');
            expect(formatNotificationDate('2026-11-20', tz, 'en')).toBe('20 Nov 2026');
        }
        const email = buildShiftCloseEmail({
            staffName: 'Айгуль', staffEmail: 'staff@example.invalid', shiftDate: '2026-11-20',
            totalAmount: 1000, masterShare: 600, salonShare: 400, itemsCount: 1,
            hoursWorked: null, guaranteedAmount: null, topupAmount: null,
        }, 'ru');
        expect(email.text).toContain('20.11.2026');
    });
});

describe('business settings: time zone', () => {
    test.each(['Asia/Almaty', 'Europe/Moscow', 'Asia/Bishkek', 'UTC'])('accepts a known zone %s', (tz) => {
        expect(businessSettingsPatchSchema.safeParse({ tz }).success).toBe(true);
    });

    test.each(['', 'Mars/Olympus', ' Asia/Almaty', 'x'.repeat(65), null, 5])('rejects %j', (tz) => {
        expect(businessSettingsPatchSchema.safeParse({ tz }).success).toBe(false);
    });

    test('the service writes the zone with the other changed fields only', async () => {
        const query = {
            update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { tz: 'Asia/Almaty' }, error: null }),
        };
        const admin = { from: jest.fn().mockReturnValue(query) };
        expect(await updateBusinessContactSettings({ admin, bizId: 'biz-1', input: { tz: 'Asia/Almaty' } }))
            .toMatchObject({ ok: true, data: { tz: 'Asia/Almaty' } });
        expect(query.update).toHaveBeenCalledWith({ tz: 'Asia/Almaty' });
        expect(query.select).toHaveBeenCalledWith('contact_phone,contact_whatsapp,contact_email,website_url,tz');
    });

    test('an unknown zone is rejected before any write', async () => {
        const admin = { from: jest.fn() };
        expect(await updateBusinessContactSettings({ admin, bizId: 'biz-1', input: { tz: 'Mars/Olympus' } }))
            .toMatchObject({ ok: false, status: 400, message: 'Неизвестный часовой пояс' });
        expect(admin.from).not.toHaveBeenCalled();
    });
});
