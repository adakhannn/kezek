import { buildShiftCloseEmail, readNotificationLocales, sendShiftCloseNotification, type ShiftCloseNotificationData } from '@/lib/notifications/shiftNotifications';

// FE-10: the shift-close letter is in each recipient's preferred_locale; NULL stays Russian.
jest.mock('@/lib/env', () => ({ getResendApiKey: () => 'synthetic-key', getEmailFrom: () => 'Kezek <synthetic@example.invalid>' }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));

const data: ShiftCloseNotificationData = {
    staffName: 'Aida <A>', staffEmail: 'staff@example.invalid', ownerEmail: 'owner@example.invalid',
    shiftDate: '2026-11-20', totalAmount: 1500, masterShare: 900.5, salonShare: 599.5, itemsCount: 3,
    hoursWorked: 8.25, guaranteedAmount: 1000, topupAmount: 99.5,
};

describe('buildShiftCloseEmail', () => {
    test('Russian keeps the pre-FE-10 text', () => {
        const email = buildShiftCloseEmail(data, 'ru');
        expect(email.subject).toBe('Kezek: Смена закрыта за 20.11.2026');
        expect(email.text).toBe(`
Смена закрыта

Aida <A> закрыл(а) смену за 20.11.2026

Итоги:
- Количество клиентов: 3
- Общий оборот: 1500.00 сом
- Сотруднику: 900.50 сом
- Бизнесу: 599.50 сом
- Отработано часов: 8.25

- Гарантированная оплата: 1000.00 сом

- Доплата: 99.50 сом


Подробности доступны в личном кабинете Kezek.
        `);
        expect(email.html).toContain('<h1>Смена закрыта</h1>');
        expect(email.html).toContain('<p>Aida &lt;A&gt; закрыл(а) смену за 20.11.2026</p>');
        expect(email.html).toContain('<span class="label">Общий оборот:</span>');
    });

    test('Kyrgyz: texts, the kyDateFormat date and сом', () => {
        const email = buildShiftCloseEmail(data, 'ky');
        expect(email.subject).toBe('Kezek: 20.11.2026 күнкү смена жабылды');
        expect(email.text).toContain('Aida <A> 20.11.2026 күнкү сменаны жапты');
        expect(email.text).toContain('Жыйынтыктар:\n- Кардарлардын саны: 3\n- Жалпы жүгүртүү: 1500.00 сом\n- Кызматкерге: 900.50 сом\n- Бизнеске: 599.50 сом');
        expect(email.text).toContain('- Иштелген сааттар: 8.25');
        expect(email.text).toContain('- Кепилденген төлөм: 1000.00 сом');
        expect(email.text).toContain('- Кошумча төлөм: 99.50 сом');
        expect(email.html).toContain('<h1>Смена жабылды</h1>');
        expect(email.html).toContain('<span class="label">Сменанын күнү:</span>');
        expect(email.html).toContain('Толук маалымат Kezek жеке кабинетиңизде жеткиликтүү.');
        expect(email.html).not.toMatch(/Смена закрыта|Итоги|Сотруднику/);
    });

    test('English: texts, a month-name date and som', () => {
        const email = buildShiftCloseEmail(data, 'en');
        expect(email.subject).toBe('Kezek: Shift closed for 20 Nov 2026');
        expect(email.text).toContain('Aida <A> closed the shift for 20 Nov 2026');
        expect(email.text).toContain('- Total turnover: 1500.00 som');
        expect(email.text).toContain('- To the employee: 900.50 som');
        expect(email.text).toContain('- Guaranteed pay: 1000.00 som');
        expect(email.html).toContain('<span class="label">Hours worked:</span>');
        expect(email.html).toContain('<p>Aida &lt;A&gt; closed the shift for 20 Nov 2026</p>');
        expect(email.html).not.toMatch(/[А-Яа-яЁё]/);
    });

    test('a missing name is the word "employee" in the recipient language', () => {
        expect(buildShiftCloseEmail({ ...data, staffName: null }, 'ru').text).toContain('Сотрудник закрыл(а) смену');
        expect(buildShiftCloseEmail({ ...data, staffName: '' }, 'ky').text).toContain('Кызматкер 20.11.2026 күнкү сменаны жапты');
        expect(buildShiftCloseEmail({ ...data, staffName: null }, 'en').text).toContain('Employee closed the shift');
    });
});

describe('sendShiftCloseNotification', () => {
    const sent = () => (global.fetch as jest.Mock).mock.calls.map(([, init]) => JSON.parse(init.body));
    beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never; });

    test('the employee and the owner each get their own language', async () => {
        await sendShiftCloseNotification({ ...data, staffLocale: 'ky', ownerLocale: 'en' });
        expect(sent().map((body) => [body.to[0], body.subject])).toEqual([
            ['staff@example.invalid', 'Kezek: 20.11.2026 күнкү смена жабылды'],
            ['owner@example.invalid', 'Kezek: Shift closed for 20 Nov 2026'],
        ]);
    });

    test('a null, absent or unknown locale stays Russian', async () => {
        await sendShiftCloseNotification({ ...data, staffLocale: null, ownerLocale: 'de' });
        await sendShiftCloseNotification({ ...data });
        expect(sent().map((body) => body.subject)).toEqual(Array(4).fill('Kezek: Смена закрыта за 20.11.2026'));
    });
});

describe('readNotificationLocales', () => {
    function adminWith(result: unknown) {
        const calls: unknown[][] = [];
        const builder = {
            select: (...args: unknown[]) => { calls.push(['select', ...args]); return builder; },
            in: (...args: unknown[]) => { calls.push(['in', ...args]); return Promise.resolve(result); },
        };
        return { admin: { from: jest.fn(() => builder) }, calls };
    }

    test('reads preferred_locale of the distinct users; null is Russian', async () => {
        const { admin, calls } = adminWith({ data: [{ id: 'a', preferred_locale: 'ky' }, { id: 'b', preferred_locale: null }], error: null });
        const locales = await readNotificationLocales(admin as never, ['a', 'b', 'a', null, undefined]);
        expect(admin.from).toHaveBeenCalledWith('profiles');
        expect(calls).toEqual([['select', 'id,preferred_locale'], ['in', 'id', ['a', 'b']]]);
        expect([...locales]).toEqual([['a', 'ky'], ['b', 'ru']]);
    });

    test('a failed read or no users gives an empty map, so the letters go out in Russian', async () => {
        const { admin } = adminWith({ data: null, error: { message: 'offline' } });
        expect((await readNotificationLocales(admin as never, ['a'])).size).toBe(0);
        const idle = adminWith({ data: [], error: null });
        expect((await readNotificationLocales(idle.admin as never, [null])).size).toBe(0);
        expect(idle.admin.from).not.toHaveBeenCalled();
    });
});
