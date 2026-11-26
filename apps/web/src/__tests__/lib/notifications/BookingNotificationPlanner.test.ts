import { planBookingNotifications, prepareBookingNotificationContext } from '@/lib/notifications/BookingNotificationPlanner';
import { ParticipantDataService } from '@/lib/notifications/ParticipantDataService';
import type { BookingRow, ParticipantData } from '@/lib/notifications/types';
import { getEmailFrom, getWhatsAppBookingTemplateLanguage, getWhatsAppBookingTemplateName } from '@/lib/env';
import { listPushTokens } from '@/lib/pushTokens';
import { listManagerPushRecipients } from '@/lib/notifications/managerPushRecipients';

jest.mock('@/lib/notifications/ParticipantDataService');
jest.mock('@/lib/pushTokens', () => ({ listPushTokens: jest.fn() }));
jest.mock('@/lib/notifications/managerPushRecipients', () => ({ listManagerPushRecipients: jest.fn() }));
jest.mock('@/lib/env', () => ({ getEmailFrom: jest.fn(() => 'Kezek <synthetic@example.invalid>'), getSiteOrigin: () => 'https://example.invalid', getTimezone: () => 'Asia/Bishkek',
    getWhatsAppBookingTemplateName: jest.fn(), getWhatsAppBookingTemplateLanguage: jest.fn() }));

const TEMPLATES = { confirmed: 'kezek_booking_confirmed', cancelled: 'kezek_booking_cancelled', reminder: 'kezek_booking_reminder' };
function configureTemplates(names: Partial<typeof TEMPLATES> = TEMPLATES, languages: Partial<Record<'default' | 'ky' | 'en', string>> = {}) {
    jest.mocked(getWhatsAppBookingTemplateName).mockImplementation(kind => names[kind] ?? '');
    jest.mocked(getWhatsAppBookingTemplateLanguage).mockImplementation(locale => languages[locale] ?? (locale === 'default' ? 'ru' : ''));
}

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

beforeEach(() => { jest.clearAllMocks(); configureTemplates(); jest.mocked(listPushTokens).mockResolvedValue([]); jest.mocked(listManagerPushRecipients).mockResolvedValue([]); });
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

test.each(['', '   '])('EMAIL_FROM %j turns e-mail off: no e-mail deliveries are planned, other channels are (R25-13)', async from => {
    jest.mocked(getEmailFrom).mockReturnValueOnce(from);
    mockParticipants(
        participant({ email: 'client@example.invalid', telegramId: 123, telegramVerified: true }),
        participant({ email: 'staff@example.invalid' }), participant({ email: 'owner@example.invalid' }),
    );
    const plan = await planBookingNotifications({} as never, booking, 'confirm');
    expect(plan.map(value => value.channel)).toEqual(['telegram']);
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

describe('WhatsApp booking messages are approved templates (R25-07)', () => {
    const whatsappClient = () => participant({ email: 'client@example.invalid', telegramId: 123, telegramVerified: true, whatsappPhone: '+996 555 000 111', whatsappVerified: true });

    test('confirm becomes a template message with five body parameters in the documented order', async () => {
        mockParticipants(whatsappClient(), participant(), participant());
        const plan = await planBookingNotifications({} as never, booking, 'confirm');
        const whatsapp = plan.filter(value => value.channel === 'whatsapp');
        expect(whatsapp).toHaveLength(1);
        expect(whatsapp[0].payload).toEqual({
            messaging_product: 'whatsapp', recipient_type: 'individual', to: '996555000111', type: 'template',
            template: { name: 'kezek_booking_confirmed', language: { code: 'ru' }, components: [{ type: 'body', parameters: [
                { type: 'text', text: 'Business' }, { type: 'text', text: 'Service' }, { type: 'text', text: 'Staff' },
                { type: 'text', text: '01.01.2035 16:00' }, { type: 'text', text: 'https://example.invalid/booking/booking' },
            ] }] },
        });
        expect(JSON.stringify(whatsapp[0].payload)).not.toContain('"text":{');
    });

    test('cancel uses the cancelled template; parameters never carry line breaks or tabs', async () => {
        mockParticipants(whatsappClient(), participant(), participant());
        const plan = await planBookingNotifications({} as never, { ...booking, status: 'cancelled',
            biz: { ...booking.biz as object, name: 'Multi\nline\tname    here' } as BookingRow['biz'] }, 'cancel');
        const template = plan.find(value => value.channel === 'whatsapp')!.payload.template as { name: string; components: { parameters: { text: string }[] }[] };
        expect(template.name).toBe('kezek_booking_cancelled');
        expect(template.components[0].parameters[0].text).toBe('Multi line name here');
    });

    test.each(['confirm', 'cancel', 'reminder_24h'] as const)('no configured template for %s plans no WhatsApp delivery and does not fail', async type => {
        configureTemplates({});
        mockParticipants(whatsappClient(), participant({ whatsappPhone: '+996555000222' }), participant({ whatsappPhone: '+996555000333' }));
        const plan = await planBookingNotifications({} as never, booking, type);
        expect(plan.map(value => value.channel)).not.toContain('whatsapp');
        expect(plan.map(value => value.channel)).toContain('telegram');
    });

    test('a hold has no template, so no WhatsApp message', async () => {
        mockParticipants(whatsappClient(), participant(), participant());
        const plan = await planBookingNotifications({} as never, { ...booking, status: 'hold' }, 'hold');
        expect(plan.map(value => value.channel)).not.toContain('whatsapp');
    });

    test('a ky recipient gets the ky translation when its language code is set, otherwise the default one in Russian', async () => {
        mockParticipants({ ...whatsappClient(), locale: 'ky' }, participant(), participant());
        configureTemplates(TEMPLATES, { ky: 'ky_KG' });
        let template = (await planBookingNotifications({} as never, booking, 'confirm')).find(value => value.channel === 'whatsapp')!.payload.template as Record<string, unknown>;
        expect(template.language).toEqual({ code: 'ky_KG' });
        configureTemplates(TEMPLATES, {});
        template = (await planBookingNotifications({} as never, booking, 'confirm')).find(value => value.channel === 'whatsapp')!.payload.template as Record<string, unknown>;
        expect(template.language).toEqual({ code: 'ru' });
    });
});

describe('reminders before the visit', () => {
    test.each(['reminder_24h', 'reminder_2h'] as const)('%s goes to the client only, on every client channel, without calendar file', async type => {
        const staffData = jest.fn(); const ownerData = jest.fn();
        jest.mocked(ParticipantDataService).mockImplementation(() => ({
            getClientData: jest.fn().mockResolvedValue(participant({ email: 'client@example.invalid', telegramId: 123, telegramVerified: true, whatsappPhone: '+996555000111', whatsappVerified: true, locale: 'en' })),
            getStaffData: staffData, getOwnerData: ownerData,
        }) as unknown as ParticipantDataService);
        const plan = await planBookingNotifications({} as never, booking, type);
        expect(staffData).not.toHaveBeenCalled(); expect(ownerData).not.toHaveBeenCalled();
        expect(plan.map(value => value.channel)).toEqual(['email', 'telegram', 'whatsapp']);
        expect(plan[0].payload).toEqual(expect.objectContaining({ to: ['client@example.invalid'], subject: 'Kezek: Booking reminder' }));
        expect(plan[0].payload.attachments).toBeUndefined();
        expect(plan[0].payload.reply_to).toBeUndefined();
        expect(plan[1].payload.text).toContain('Booking reminder');
        expect((plan[2].payload.template as { name: string }).name).toBe('kezek_booking_reminder');
    });

    test('client opt-outs (notify_email / notify_whatsapp / notify_telegram) leave a reminder with no deliveries', async () => {
        mockParticipants(participant({ email: 'client@example.invalid', notifyEmail: false, telegramId: 123, telegramVerified: true, notifyTelegram: false,
            whatsappPhone: '+996555000111', whatsappVerified: true, notifyWhatsApp: false }), participant(), participant());
        expect(await planBookingNotifications({} as never, booking, 'reminder_2h')).toEqual([]);
    });
});

describe('push notifications to the app', () => {
    const CLIENT_TOKEN = 'ExponentPushToken[client-install-0001]';
    const STAFF_TOKEN = 'ExponentPushToken[staff-install-00001]';
    const bookingWithStaffAccount: BookingRow = { ...booking, staff: { full_name: 'Staff', email: null, phone: null, user_id: 'staff-user' } };

    test('confirm goes to every client install and the master\'s linked account, each in its language, with the booking in data', async () => {
        mockParticipants(participant({ locale: 'en' }), participant({ locale: 'ky' }), participant());
        jest.mocked(listPushTokens).mockResolvedValue([
            { user_id: 'client', token: CLIENT_TOKEN }, { user_id: 'staff-user', token: STAFF_TOKEN },
        ]);
        const admin = {} as never;
        const plan = (await planBookingNotifications(admin, bookingWithStaffAccount, 'confirm')).filter(value => value.channel === 'push');
        expect(listPushTokens).toHaveBeenCalledWith(admin, ['client', 'staff-user']);
        expect(plan.map(value => value.payload.to)).toEqual([CLIENT_TOKEN, STAFF_TOKEN]);
        expect(plan[0].payload).toEqual(expect.objectContaining({
            title: 'Booking confirmed', data: { bookingId: 'booking', type: 'confirm' }, sound: 'default', channelId: 'default',
        }));
        expect(plan[0].payload.body).toBe('Business · Service · Staff · 1 Jan 2035, 16:00');
        expect(plan[1].payload.title).not.toBe('Booking confirmed');
        plan.forEach(value => { expect(value.key).toMatch(/^push:[a-f0-9]{64}$/); expect(value.key).not.toContain('install'); });
    });

    test.each(['reminder_24h', 'reminder_2h'] as const)('%s goes to the client\'s installs only', async type => {
        mockParticipants(participant(), participant(), participant());
        jest.mocked(listPushTokens).mockResolvedValue([{ user_id: 'client', token: CLIENT_TOKEN }]);
        const plan = (await planBookingNotifications({} as never, bookingWithStaffAccount, type)).filter(value => value.channel === 'push');
        expect(listPushTokens).toHaveBeenCalledWith(expect.anything(), ['client']);
        expect(plan).toHaveLength(1);
        expect(plan[0].payload.data).toEqual({ bookingId: 'booking', type });
    });

    test('one install shared by client and master gets one message; a guest booking without accounts reads no tokens', async () => {
        mockParticipants(participant(), participant(), participant());
        jest.mocked(listPushTokens).mockResolvedValue([{ user_id: 'client', token: CLIENT_TOKEN }]);
        const self = { ...bookingWithStaffAccount, staff: { full_name: 'Staff', email: null, phone: null, user_id: 'client' } };
        expect((await planBookingNotifications({} as never, self, 'cancel')).filter(value => value.channel === 'push')).toHaveLength(1);
        jest.mocked(listPushTokens).mockClear();
        await planBookingNotifications({} as never, { ...booking, client_id: null }, 'confirm');
        expect(listPushTokens).not.toHaveBeenCalled();
    });

    test('a hold is not pushed and reads no tokens', async () => {
        mockParticipants(participant(), participant(), participant());
        const plan = await planBookingNotifications({} as never, { ...bookingWithStaffAccount, status: 'hold' }, 'hold');
        expect(plan.filter(value => value.channel === 'push')).toEqual([]);
        expect(listPushTokens).not.toHaveBeenCalled();
    });

    test('a token read failure fails preparation instead of planning no push', async () => {
        mockParticipants(participant(), participant(), participant());
        jest.mocked(listPushTokens).mockRejectedValue(new Error('PUSH_TOKEN_LIST_FAILED'));
        await expect(planBookingNotifications({} as never, booking, 'confirm')).rejects.toThrow('PUSH_TOKEN_LIST_FAILED');
    });

    describe('owner and business managers (O2)', () => {
        const OWNER_TOKEN = 'ExponentPushToken[owner-install-00001]';
        const MANAGER_TOKEN = 'ExponentPushToken[manager-install-0001]';
        const managed: BookingRow = { ...bookingWithStaffAccount,
            biz: { ...booking.biz as object, id: 'biz-1', owner_id: 'owner-user' } as BookingRow['biz'] };

        test.each(['confirm', 'cancel'] as const)('%s also goes to the owner and every manager install, each in its language', async type => {
            mockParticipants(participant({ locale: 'en' }), participant(), participant());
            jest.mocked(listManagerPushRecipients).mockResolvedValue([
                { userId: 'owner-user', locale: 'ky' }, { userId: 'manager-user', locale: 'en' },
            ]);
            jest.mocked(listPushTokens).mockResolvedValue([
                { user_id: 'client', token: CLIENT_TOKEN }, { user_id: 'owner-user', token: OWNER_TOKEN }, { user_id: 'manager-user', token: MANAGER_TOKEN },
            ]);
            const admin = {} as never;
            const plan = (await planBookingNotifications(admin, managed, type)).filter(value => value.channel === 'push');
            expect(listManagerPushRecipients).toHaveBeenCalledWith(admin, 'biz-1', 'owner-user');
            expect(listPushTokens).toHaveBeenCalledWith(admin, ['client', 'staff-user', 'owner-user', 'manager-user']);
            expect(plan.map(value => value.payload.to)).toEqual([CLIENT_TOKEN, OWNER_TOKEN, MANAGER_TOKEN]);
            expect(plan[2].payload.title).toBe(type === 'confirm' ? 'Booking confirmed' : plan[0].payload.title);
            expect(plan[1].payload.title).not.toBe(plan[2].payload.title);
            expect(plan[1].payload.data).toEqual({ bookingId: 'booking', type });
        });

        test('an install shared by the master and a manager (or the owner booking himself) gets one message', async () => {
            mockParticipants(participant(), participant(), participant());
            jest.mocked(listManagerPushRecipients).mockResolvedValue([{ userId: 'staff-user', locale: 'ru' }, { userId: 'client', locale: 'ru' }]);
            jest.mocked(listPushTokens).mockResolvedValue([{ user_id: 'client', token: CLIENT_TOKEN }, { user_id: 'staff-user', token: STAFF_TOKEN }]);
            const plan = (await planBookingNotifications({} as never, managed, 'confirm')).filter(value => value.channel === 'push');
            expect(plan.map(value => value.payload.to)).toEqual([CLIENT_TOKEN, STAFF_TOKEN]);
        });

        test.each(['reminder_24h', 'reminder_2h', 'hold'] as const)('%s does not look up managers', async type => {
            mockParticipants(participant(), participant(), participant());
            await planBookingNotifications({} as never, { ...managed, status: type === 'hold' ? 'hold' : 'confirmed' }, type);
            expect(listManagerPushRecipients).not.toHaveBeenCalled();
        });

        test('a manager lookup failure fails preparation instead of dropping the managers', async () => {
            mockParticipants(participant(), participant(), participant());
            jest.mocked(listManagerPushRecipients).mockRejectedValue(new Error('BUSINESS_ACCESS_READ_FAILED: user_roles'));
            await expect(planBookingNotifications({} as never, managed, 'cancel')).rejects.toThrow('BUSINESS_ACCESS_READ_FAILED');
        });
    });
});
