import { planBookingNotifications } from '@/lib/notifications/BookingNotificationPlanner';
import { ParticipantDataService } from '@/lib/notifications/ParticipantDataService';
import type { BookingRow, ParticipantData } from '@/lib/notifications/types';

// FE-10: each recipient's message is in that recipient's preferred_locale.
// No app installs: push tokens are covered in BookingNotificationPlanner.test.ts.
jest.mock('@/lib/pushTokens', () => ({ listPushTokens: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/notifications/managerPushRecipients', () => ({ listManagerPushRecipients: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/env', () => ({ getEmailFrom: () => 'Kezek <synthetic@example.invalid>', getSiteOrigin: () => 'https://example.invalid', getTimezone: () => 'Asia/Bishkek',
    getWhatsAppBookingTemplateName: () => 'kezek_booking_confirmed',
    getWhatsAppBookingTemplateLanguage: (locale: string) => ({ default: 'ru', ky: 'ky_KG', en: 'en' } as Record<string, string>)[locale] }));

const participant = (values: Partial<ParticipantData> = {}): ParticipantData => ({
    email: null, notificationEmails: [], name: 'Synthetic', phone: null, whatsappPhone: null, telegramId: null,
    notifyEmail: true, notifyWhatsApp: true, notifyTelegram: true, whatsappVerified: false, telegramVerified: false, ...values,
});
const booking: BookingRow = { id: 'booking', notification_revision: 1, status: 'confirmed',
    start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z', created_at: '2034-01-01T10:00:00Z',
    client_id: 'client', client_name: 'Synthetic', client_email: null, client_phone: null,
    services: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 30, price_from: 100, price_to: 100 },
    staff: { full_name: 'Staff', email: null, phone: null, user_id: 'staff-user' }, branches: { name: 'Branch', address: null },
    biz: { name: 'Business', tz: 'Asia/Bishkek', slug: 'business', address: null, phones: null, owner_id: 'owner', email_notify_to: ['office@example.invalid'] },
};

afterEach(() => { jest.restoreAllMocks(); });

function mockParticipants(client: ParticipantData, staff: ParticipantData, owner: ParticipantData) {
    jest.spyOn(ParticipantDataService.prototype, 'getClientData').mockResolvedValue(client);
    jest.spyOn(ParticipantDataService.prototype, 'getStaffData').mockResolvedValue(staff);
    jest.spyOn(ParticipantDataService.prototype, 'getOwnerData').mockResolvedValue(owner);
}

test('client, staff and owner each get their own language on every channel; null and the office address stay Russian', async () => {
    mockParticipants(
        participant({ locale: 'ky', email: 'client@example.invalid', telegramId: 1, telegramVerified: true, whatsappPhone: '+996555000111', whatsappVerified: true }),
        participant({ locale: 'en', email: 'staff@example.invalid', telegramId: 2, whatsappPhone: '+996555000222' }),
        participant({ locale: null, email: 'owner@example.invalid', telegramId: 3, whatsappPhone: '+996555000333' }),
    );
    const plan = await planBookingNotifications({} as never, booking, 'confirm');

    const emails = plan.filter(value => value.channel === 'email').map(value => value.payload);
    expect(emails.map(payload => [(payload.to as string[])[0], payload.subject])).toEqual([
        ['client@example.invalid', 'Kezek: Жазылуу ырасталды'],
        ['staff@example.invalid', 'Kezek: Booking confirmed'],
        ['owner@example.invalid', 'Kezek: Бронь подтверждена'],
        ['office@example.invalid', 'Kezek: Бронь подтверждена'],
    ]);
    expect(emails[0].text).toContain('Кызмат: Чач кыркуу');
    expect(emails[1].text).toContain('Service: Haircut');
    expect(emails[2].text).toContain('Услуга: Стрижка');

    const telegram = plan.filter(value => value.channel === 'telegram').map(value => value.payload);
    expect(telegram.map(payload => [payload.chat_id, (payload.text as string).split(':')[0]])).toEqual([
        [1, 'Жазылуу ырасталды'], [2, 'Booking confirmed'], [3, 'Бронь подтверждена'],
    ]);

    // WhatsApp is a template (R25-07): the translation by language code, the parameters in that language.
    const whatsapp = plan.filter(value => value.channel === 'whatsapp').map(value => value.payload.template as {
        language: { code: string }; components: { parameters: { text: string }[] }[] });
    expect(whatsapp.map(template => [template.language.code, template.components[0].parameters[1].text])).toEqual([
        ['ky_KG', 'Чач кыркуу'], ['en', 'Haircut'], ['ru', 'Стрижка'],
    ]);
});

describe('ParticipantDataService reads preferred_locale with the existing profile queries', () => {
    function adminWith(profile: Record<string, unknown>) {
        const selects: string[] = [];
        const from = (table: string) => {
            const result = { data: table === 'user_notification_emails' ? [] : table === 'profiles' ? profile : null, error: null };
            const query = {
                select: (columns: string) => { if (table === 'profiles') selects.push(columns); return query; },
                eq: () => query, maybeSingle: async () => result,
                then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
            };
            return query;
        };
        const auth = { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'owner@example.invalid', user_metadata: {} } }, error: null }) } };
        return { client: { from, auth } as never, selects };
    }

    test.each([
        ['client', (s: ParticipantDataService) => s.getClientData({ client_id: 'client' } as BookingRow)],
        ['staff', (s: ParticipantDataService) => s.getStaffData({ full_name: 'Staff', email: null, phone: null, user_id: 'staff-user' })],
        ['owner', (s: ParticipantDataService) => s.getOwnerData({ owner_id: 'owner' } as never)],
    ])('%s', async (_role, load) => {
        const ky = adminWith({ preferred_locale: 'ky' });
        expect((await load(new ParticipantDataService(ky.client, ky.client, true))).locale).toBe('ky');
        expect(ky.selects.some(columns => columns.includes('preferred_locale'))).toBe(true);

        const unknown = adminWith({ preferred_locale: null });
        expect((await load(new ParticipantDataService(unknown.client, unknown.client, true))).locale).toBe('ru');
    });
});
