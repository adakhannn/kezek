import { escapeHtml } from '@/lib/htmlEscape';
import { buildEmailHtml, buildEmailText, buildTelegramText, type BookingDetails } from '@/lib/notifications/messageBuilders';
import { buildHtmlPersonal } from '@/lib/notifications/utils';

const phishing = '<a href="https://evil.test/login">Подтвердите оплату</a>';

function details(overrides: Partial<BookingDetails> = {}): BookingDetails {
    return {
        booking: {
            id: '11111111-2222-3333-4444-555555555555', status: 'confirmed',
            start_at: '2026-11-20T06:00:00.000Z', end_at: '2026-11-20T07:00:00.000Z', created_at: '2026-11-18T06:00:00.000Z',
            client_id: null, client_phone: '+996700000001', client_name: phishing, client_email: 'guest@unit.test',
            services: null, staff: null, biz: null, branches: null,
        },
        service: { name_ru: 'Стрижка <i>VIP</i>', duration_min: 60, price_from: 500, price_to: 500 },
        staff: { full_name: '<img src=x onerror=alert(1)>', email: null, phone: '+996555"><b>' },
        biz: { name: 'A & B <b>Salon</b>', email_notify_to: null, slug: 'a-b', address: 'ул. "Пушкина" <1>', phones: ['+996 555 000 000"><script>'] },
        branch: { name: 'Центр <script>alert(1)</script>', address: "it's <here>" },
        clientName: phishing,
        clientPhone: '+996700000001',
        clientEmail: '<u>guest@unit.test</u>',
        origin: 'https://kezek.vercel.app',
        timezone: 'Asia/Bishkek',
        ...overrides,
    };
}

describe('notification HTML escaping (API-07)', () => {
    test('escapeHtml covers element content and quoted attributes', () => {
        expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#039;y&#039;&gt;&amp;&lt;/a&gt;');
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(42)).toBe('42');
    });

    test('the e-mail shows client, guest and business values as text', () => {
        const html = buildEmailHtml(details(), 'confirm');

        for (const injected of ['<a href="https://evil.test', '<img', '<script', '<i>VIP', '<b>Salon', '<u>']) {
            expect(html).not.toContain(injected);
        }
        expect(html).toContain('&lt;a href=&quot;https://evil.test/login&quot;&gt;Подтвердите оплату&lt;/a&gt;');
        expect(html).toContain('A &amp; B &lt;b&gt;Salon&lt;/b&gt;');
        expect(html).toContain('Стрижка &lt;i&gt;VIP&lt;/i&gt;');
        expect(html).toContain('(+996555&quot;&gt;&lt;b&gt;)');
        expect(html).toContain('href="tel:+996555000000"');
        // The template's own markup is intact.
        expect(html).toContain('<a href="https://kezek.vercel.app/booking/11111111-2222-3333-4444-555555555555"');
        expect(html).toContain('<b>Мастер:</b>');
    });

    test('the plain-text e-mail keeps the raw text', () => {
        expect(buildEmailText(details(), 'confirm')).toContain(`Имя: ${phishing}`);
    });

    test('Telegram HTML escapes business, service and master names', () => {
        const text = buildTelegramText(details(), 'cancel');

        expect(text).toContain('Бронь отменена: <b>A &amp; B &lt;b&gt;Salon&lt;/b&gt;</b>');
        expect(text).toContain('<b>Услуга:</b> Стрижка &lt;i&gt;VIP&lt;/i&gt;');
        expect(text).toContain('<b>Мастер:</b> &lt;img src=x onerror=alert(1)&gt;');
        expect(text).toContain('<a href="https://kezek.vercel.app/booking/11111111-2222-3333-4444-555555555555">Открыть бронь</a>');
    });

    test('the personal greeting escapes the recipient name', () => {
        const html = buildHtmlPersonal('<div>body</div>', '<b>Eve</b>', 'owner');

        expect(html).toBe('<div><p style="margin:0 0 12px 0">Здравствуйте, &lt;b&gt;Eve&lt;/b&gt;! <i>(Владелец)</i></p>body</div>');
    });
});
