import { buildBookingEmailPayload } from '@/lib/notifications/emailPayload';
import { buildEmailHtml, buildEmailText, buildTelegramText, buildWhatsAppText, type BookingDetails } from '@/lib/notifications/messageBuilders';
import { notificationLocale } from '@/lib/notifications/notificationText';

// FE-10: booking notifications in the recipient's language; Russian when it is not known.
const details: BookingDetails = {
    booking: {
        id: '11111111-2222-3333-4444-555555555555', status: 'confirmed',
        start_at: '2026-11-20T06:00:00.000Z', end_at: '2026-11-20T07:00:00.000Z', created_at: '2026-11-18T06:00:00.000Z',
        client_id: null, client_phone: null, client_name: null, client_email: null,
        services: null, staff: null, biz: null, branches: null,
    },
    service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 60, price_from: 500, price_to: 700 },
    staff: { full_name: 'Aibek', email: null, phone: null },
    biz: { name: 'Salon', email_notify_to: null, slug: 'salon', address: null, phones: ['+996555000000'] },
    branch: { name: 'Center', address: null },
    clientName: 'Aida', clientPhone: '+996700000001', clientEmail: null,
    origin: 'https://kezek.vercel.app',
    timezone: 'Asia/Bishkek',
};

describe('Kyrgyz', () => {
    test('e-mail HTML', () => {
        const html = buildEmailHtml(details, 'confirm', 'ky');
        expect(html).toContain('Жазылуу ырасталды: Salon');
        expect(html).toContain('<b>Кызмат:</b> Чач кыркуу (60 мин) — 500 - 700 сом');
        expect(html).toContain('<b>Кызматкер:</b> Aibek');
        expect(html).toContain('<b>Убакыт:</b> 20.11.2026 12:00 - 13:00 (Asia/Bishkek)');
        expect(html).toContain('Ырасталган');
        expect(html).toContain('Жазылууну системада ачуу');
        expect(html).not.toMatch(/Бронь|Услуга|Мастер|Статус/);
    });

    test('e-mail text', () => {
        const text = buildEmailText(details, 'cancel', 'ky');
        expect(text.startsWith('Жазылуу жокко чыгарылды: Salon\n\nЖазылуунун маалыматтары:\n')).toBe(true);
        expect(text).toContain('Кардар жөнүндө маалымат:\nАты: Aida, Телефон: +996700000001');
        expect(text).toContain('Шилтеме: https://kezek.vercel.app/booking/');
    });

    test('Telegram', () => {
        expect(buildTelegramText(details, 'hold', 'ky')).toBe(
            'Убакыт убактылуу ээленди: <b>Salon</b>\n\n<b>Кызмат:</b> Чач кыркуу\n<b>Кызматкер:</b> Aibek\n'
            + '<b>Убакыт:</b> 20.11.2026 12:00 (Asia/Bishkek)\n<b>Абалы:</b> Ырасталган\n\n'
            + '<a href="https://kezek.vercel.app/booking/11111111-2222-3333-4444-555555555555">Жазылууну ачуу</a>');
    });

    test('WhatsApp', () => {
        expect(buildWhatsAppText({ ...details, booking: { ...details.booking, status: 'hold' } }, 'hold', 'ky')).toBe(
            'Убакыт убактылуу ээленди: Salon\n\nКызмат: Чач кыркуу\nКызматкер: Aibek\nУбакыт: 20.11.2026 12:00\n'
            + 'Абалы: Күтүүдө\n\nhttps://kezek.vercel.app/booking/11111111-2222-3333-4444-555555555555');
    });

    test('the e-mail subject, greeting and calendar file', () => {
        const payload = buildBookingEmailPayload({ email: 'a@unit.test', name: 'Aida', role: 'client', withIcs: true, locale: 'ky' }, details, 'confirm', { from: 'Kezek <x@unit.test>' });
        expect(payload.subject).toBe('Kezek: Жазылуу ырасталды');
        expect(payload.html).toContain('Саламатсызбы, Aida! <i>(Кардар)</i>');
        const ics = Buffer.from((payload.attachments as Array<{ content: string }>)[0].content, 'base64').toString('utf8');
        expect(ics).toContain('Чач кыркуу — Salon');
    });
});

describe('English', () => {
    test('e-mail HTML', () => {
        const html = buildEmailHtml(details, 'confirm', 'en');
        expect(html).toContain('Booking confirmed: Salon');
        expect(html).toContain('<b>Service:</b> Haircut (60 min) — 500 - 700 KGS');
        expect(html).toContain('<b>Time:</b> 20 Nov 2026, 12:00 - 13:00 (Asia/Bishkek)');
        expect(html).toContain('<b>Created:</b> 18 Nov 2026, 12:00');
        expect(html).toContain('This email was sent automatically by Kezek');
        expect(html).not.toMatch(/[А-Яа-яЁё]/);
    });

    test('e-mail text', () => {
        const text = buildEmailText({ ...details, branch: null, clientName: null, clientPhone: null }, 'hold', 'en');
        expect(text).toContain('Slot on hold: Salon\n\nBooking details:\n');
        expect(text).toContain('Client details:\nClient not specified');
        expect(text).toContain('Contacts: +996555000000');
        expect(text).not.toMatch(/[А-Яа-яЁё]/);
    });

    test('Telegram', () => {
        const text = buildTelegramText({ ...details, booking: { ...details.booking, status: 'cancelled' } }, 'cancel', 'en');
        expect(text).toContain('Booking cancelled: <b>Salon</b>');
        expect(text).toContain('<b>Status:</b> Cancelled');
        expect(text).toContain('>Open the booking</a>');
    });

    test('WhatsApp falls back to the Russian service name when there is no English one', () => {
        const text = buildWhatsAppText({ ...details, service: { ...details.service!, name_en: null } }, 'confirm', 'en');
        expect(text).toBe('Booking confirmed: Salon\n\nService: Стрижка\nMaster: Aibek\nTime: 20 Nov 2026, 12:00\n'
            + 'Status: Confirmed\n\nhttps://kezek.vercel.app/booking/11111111-2222-3333-4444-555555555555');
    });
});

describe('unknown language', () => {
    test.each([null, undefined, '', 'de'])('%j is Russian', (value) => {
        expect(notificationLocale(value)).toBe('ru');
    });

    test('the default is the Russian message', () => {
        expect(buildTelegramText(details, 'confirm')).toBe(buildTelegramText(details, 'confirm', 'ru'));
        expect(buildTelegramText(details, 'confirm')).toContain('Бронь подтверждена: <b>Salon</b>');
        const payload = buildBookingEmailPayload({ email: 'a@unit.test', name: null, role: 'admin' }, details, 'cancel', { from: 'f' });
        expect(payload.subject).toBe('Kezek: Бронь отменена');
        expect(payload.html).toContain('Здравствуйте! <i>(Администратор)</i>');
    });
});
