import { planBookingNotifications, prepareBookingNotificationContext } from '@/lib/notifications/BookingNotificationPlanner';
import { ParticipantDataService } from '@/lib/notifications/ParticipantDataService';
import type { BookingRow, ParticipantData } from '@/lib/notifications/types';

jest.mock('@/lib/notifications/ParticipantDataService');
jest.mock('@/lib/env', () => ({ getEmailFrom: () => 'Kezek <synthetic@example.invalid>', getSiteOrigin: () => 'https://example.invalid', getTimezone: () => 'Asia/Bishkek' }));

const participant = (values: Partial<ParticipantData> = {}): ParticipantData => ({
    email: null, notificationEmails: [], name: 'Synthetic', phone: null, whatsappPhone: null, telegramId: null,
    notifyEmail: true, notifyWhatsApp: true, notifyTelegram: true, whatsappVerified: false, telegramVerified: false, ...values,
});
const booking: BookingRow = { id: 'booking', notification_revision: 1, status: 'confirmed',
    start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z', created_at: '2034-01-01T10:00:00Z',
    client_id: 'client', client_name: 'Synthetic', client_email: null, client_phone: null,
    services: { name_ru: 'Service', duration_min: 30, price_from: 100, price_to: 100 },
    staff: { full_name: 'Staff', email: null, phone: null }, branches: { name: 'Branch', address: null },
    biz: { name: 'Business', tz: 'Asia/Bishkek', slug: 'business', address: null, phones: null, email_notify_to: ['OWNER@example.invalid', 'office@example.invalid'] },
};

beforeEach(() => { jest.clearAllMocks(); });
function mockParticipants(client: ParticipantData, staff: ParticipantData, owner: ParticipantData) {
    jest.mocked(ParticipantDataService).mockImplementation(() => ({
        getClientData: jest.fn().mockResolvedValue(client), getStaffData: jest.fn().mockResolvedValue(staff), getOwnerData: jest.fn().mockResolvedValue(owner),
    }) as unknown as ParticipantDataService);
}

test('one common recipient policy deduplicates roles/channels and persists full personalized messages', async () => {
    mockParticipants(
        participant({ email: 'CLIENT@example.invalid', telegramId: 123, telegramVerified: true, whatsappPhone: '+996555000111', whatsappVerified: true }),
        participant({ email: 'client@example.invalid', telegramId: 123, whatsappPhone: '+996555000111' }),
        participant({ email: 'owner@example.invalid', telegramId: 456, whatsappPhone: '+996555000222' }),
    );
    const admin = {} as never;
    const plan = await planBookingNotifications(admin, booking, 'confirm');
    expect(ParticipantDataService).toHaveBeenCalledWith(admin, admin, true);
    expect(plan.filter(value => value.channel === 'email')).toHaveLength(3);
    expect(plan.filter(value => value.channel === 'telegram')).toHaveLength(2);
    expect(plan.filter(value => value.channel === 'whatsapp')).toHaveLength(2);
    expect(plan[0].payload.to).toEqual(['client@example.invalid']);
    expect(plan[0].payload.attachments).toEqual([expect.objectContaining({ filename: 'booking.ics', content: expect.any(String) })]);
    expect(plan[1].payload.attachments).toBeUndefined();
    plan.forEach(value => { expect(value.key).toMatch(/^[a-z]+:[a-f0-9]{64}$/); expect(value.key).not.toContain('example.invalid'); });
    expect(JSON.stringify(plan)).not.toContain('Authorization');
});

test('client verification and explicit opt-outs are honored without skipping messages merely because provider config is absent', async () => {
    mockParticipants(
        participant({ email: 'client@example.invalid', notifyEmail: false, telegramId: 123, whatsappPhone: '+996555000111' }),
        participant({ notifyEmail: false, telegramId: 456, notifyTelegram: false, whatsappPhone: '+996555000222', notifyWhatsApp: false }),
        participant({ notifyEmail: false, notifyTelegram: false, notifyWhatsApp: false }),
    );
    const plan = await planBookingNotifications({} as never, { ...booking, biz: { ...booking.biz as object, email_notify_to: [] } as BookingRow['biz'] }, 'cancel');
    expect(plan).toEqual([]);
});

test('lookup errors cannot be mistaken for an empty completed plan', async () => {
    jest.mocked(ParticipantDataService).mockImplementation(() => ({
        getClientData: jest.fn().mockRejectedValue(new Error('lookup failed')), getStaffData: jest.fn().mockResolvedValue(participant()), getOwnerData: jest.fn().mockResolvedValue(participant()),
    }) as unknown as ParticipantDataService);
    await expect(planBookingNotifications({} as never, booking, 'confirm')).rejects.toThrow('lookup failed');
});

test.each([
    ['America/New_York', '01:30', '03:30'],
    ['Asia/Bishkek', '12:30', '13:30'],
    [null, '12:30', '13:30'],
])('business timezone %s controls payload local times across the DST boundary', async (tz, start, end) => {
    mockParticipants(participant({ email: 'client@example.invalid' }), participant(), participant());
    const plan = await planBookingNotifications({} as never, { ...booking,
        start_at: '2026-03-08T06:30:00Z', end_at: '2026-03-08T07:30:00Z',
        biz: { ...booking.biz as object, tz } as BookingRow['biz'],
    }, 'confirm');
    expect(plan[0].payload.text).toContain(start);
    expect(plan[0].payload.text).toContain(end);
});

test.each(['', 'Invalid/Zone', undefined])('missing/invalid business timezone %j cannot silently use server timezone', async tz => {
    mockParticipants(participant(), participant(), participant());
    await expect(prepareBookingNotificationContext(new ParticipantDataService({} as never, {} as never), {
        ...booking, biz: { ...booking.biz as object, tz } as BookingRow['biz'],
    })).rejects.toThrow(/NOTIFICATION_TIMEZONE/);
});
