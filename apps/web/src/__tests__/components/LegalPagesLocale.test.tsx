/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import DataDeletionPage, { generateMetadata as dataDeletionMetadata } from '@/app/data-deletion/page';
import PrivacyPage, { generateMetadata as privacyMetadata } from '@/app/privacy/page';
import TermsPage, { generateMetadata as termsMetadata } from '@/app/terms/page';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
jest.mock('@/app/_components/i18n/server', () => ({
    getServerLocale: async () => mockLocale,
}));

const pages = [
    ['privacy', PrivacyPage, privacyMetadata],
    ['terms', TermsPage, termsMetadata],
    ['data-deletion', DataDeletionPage, dataDeletionMetadata],
] as const;

describe('legal pages follow the language of the request (FE-10)', () => {
    afterEach(() => { mockLocale = 'ru'; });

    it.each(pages)('%s has no Russian text in English', async (_name, Page, metadata) => {
        mockLocale = 'en';
        const { container } = render(await Page());
        expect(container.textContent).not.toMatch(/[А-Яа-яЁё]/);
        expect(String((await metadata()).title)).not.toMatch(/[А-Яа-яЁё]/);
    });

    it('shows the Kyrgyz texts and keeps the links in place', async () => {
        mockLocale = 'ky';
        const { container, getByRole } = render(await TermsPage());
        expect(container.textContent).toContain('Пайдалануучу келишими');
        expect(container.textContent).toContain('Колдонуучулардын жеке маалыматтары Купуялык саясатына ылайык иштетилет.');
        expect(getByRole('link', { name: 'Купуялык саясатына' }).getAttribute('href')).toBe('/privacy');
    });

    it('keeps the Russian texts by default', async () => {
        const { container } = render(await PrivacyPage());
        expect(container.textContent).toContain('Настоящая Политика конфиденциальности определяет порядок обработки');
        expect((await privacyMetadata()).title).toBe('Политика конфиденциальности — Kezek');
    });
});
