/** @jest-environment jsdom */
// The live legal pages say what the code does (docs/legal/PRIVACY_DRAFT.md, TERMS_DRAFT.md):
// a fixed update date, no SMS, no analytics cookies, deletion after 7 days by a daily job.
import { render } from '@testing-library/react';

import { formatLegalUpdatedAt } from '@/app/_components/i18n/legal';
import DataDeletionPage from '@/app/data-deletion/page';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
jest.mock('@/app/_components/i18n/server', () => ({
    getServerLocale: async () => mockLocale,
}));

const locales = ['ru', 'ky', 'en'] as const;
const pages = [
    ['privacy', PrivacyPage],
    ['terms', TermsPage],
    ['data-deletion', DataDeletionPage],
] as const;

async function textOf(Page: () => Promise<React.ReactElement>, locale: (typeof locales)[number]) {
    mockLocale = locale;
    const { container, unmount } = render(await Page());
    const text = container.textContent ?? '';
    unmount();
    return text;
}

describe('legal pages state the facts of the code', () => {
    afterEach(() => {
        mockLocale = 'ru';
        jest.useRealTimers();
    });

    test.each([
        ['ru', '28 ноября 2026'],
        ['ky', '2026-ж., 28-ноябрь'],
        ['en', 'November 28, 2026'],
    ] as const)('%s: the update date is the fixed date in the owner style', (locale, expected) => {
        expect(formatLegalUpdatedAt(locale)).toBe(expected);
    });

    it.each(pages)('%s shows the fixed update date, not the day it is opened', async (_name, Page) => {
        jest.useFakeTimers({ now: new Date('2027-03-15T09:00:00Z') });
        const ru = await textOf(Page, 'ru');
        expect(ru).toContain('Последнее обновление: 28 ноября 2026');
        expect(ru).not.toContain('2027');
        expect(await textOf(Page, 'en')).toContain('Last updated: November 28, 2026');
        expect(await textOf(Page, 'ky')).toContain('Акыркы жаңыртуу: 2026-ж., 28-ноябрь');
    });

    it.each(pages)('%s promises no SMS, no feedback form and no analytics companies', async (_name, Page) => {
        for (const locale of locales) {
            const text = await textOf(Page, locale);
            expect(text).not.toMatch(/SMS|СМС/i);
            expect(text).not.toMatch(/форм[аыу] обратной связи|кайтарым байланыш формас|feedback form/i);
            expect(text).not.toMatch(/Аналитические cookies|Функциональные cookies|Аналитикалык cookies —|Функционалдык cookies|Analytics cookies —|Functional cookies/);
            expect(text).not.toMatch(/услуги аналитики|аналитика жана Сервистин сапатын|provide analytics/i);
            expect(text).not.toMatch(/Опасная зона|Коркунучтуу аймак|Danger zone/);
        }
    });

    it('privacy lists only the necessary cookies the site sets and the real notification channels', async () => {
        const ru = await textOf(PrivacyPage, 'ru');
        expect(ru).toContain('Сервис использует только необходимые cookies. Аналитических и рекламных cookies нет.');
        expect(ru).toContain('kezek_lang');
        expect(ru).toContain('по e-mail, в Telegram, WhatsApp и push-уведомлениями');
        const en = await textOf(PrivacyPage, 'en');
        expect(en).toContain('There are no analytics or advertising cookies.');
    });

    it('data deletion explains the 7 days, the daily job, what stays and what blocks it', async () => {
        const ru = await textOf(DataDeletionPage, 'ru');
        expect(ru).toContain('Удаление выполняется автоматически через 7 дней после запроса.');
        expect(ru).toContain('7 дней запрос можно отменить там же, в разделе «Удаление аккаунта»');
        expect(ru).toContain('затем аккаунт удаляется автоматически ежедневной задачей; отдельного уведомления о завершении удаления нет');
        expect(ru).toContain('вместо имени указывается «Удалённый пользователь», а телефон и e-mail стираются');
        expect(ru).toContain('неиспользованные визиты');
        expect(ru).toContain('вы владелец бизнеса');
        expect(ru).toContain('у вас есть будущие записи');
        expect(ru).toContain('Google, Яндекс, Telegram или WhatsApp, в приложении на iPhone — также Apple');
        expect(ru).not.toMatch(/30 дней|3 рабочих дней|Удаление отдельных бронирований/);

        const en = await textOf(DataDeletionPage, 'en');
        expect(en).toContain('Deletion runs automatically 7 days after your request.');
        expect(en).toContain('then the account is deleted automatically by a daily job; there is no separate notice when deletion is complete');
        expect(en).not.toMatch(/30 days|3 business days/);

        const ky = await textOf(DataDeletionPage, 'ky');
        expect(ky).toContain('Өчүрүү суроодон 7 күн өткөндөн кийин автоматтык түрдө аткарылат.');
        expect(ky).not.toMatch(/30 күн|3 жумуш күн/);
    });

    it('terms: real sign-in methods, cancellation rules, no payments, Osh only', async () => {
        const ru = await textOf(TermsPage, 'ru');
        expect(ru).toContain('Войти в Сервис можно через Google, Яндекс, Telegram или WhatsApp, в приложении на iPhone — также через Apple.');
        expect(ru).toContain('Свою запись вы можете отменить до начала визита.');
        expect(ru).toContain('После начала визита изменить запись может только салон.');
        expect(ru).toContain('Оплаты через Kezek нет');
        expect(ru).not.toContain('других регионов');
        expect(ru).not.toContain('только в соответствии с правилами выбранного бизнеса');
        const en = await textOf(TermsPage, 'en');
        expect(en).toContain('There are no payments through Kezek');
        expect(en).not.toContain('other regions');
        expect(await textOf(TermsPage, 'ky')).not.toContain('башка аймактардагы');
    });
});
