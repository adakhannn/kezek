/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { Footer } from '@/app/_components/Footer';
import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/app/_components/i18n/LanguageSwitcher';

describe('Footer localization', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.cookie = 'kezek_lang=ru; path=/';
    });

    it('switches business entry links with the shared locale', () => {
        render(
            <LanguageProvider>
                <LanguageSwitcher />
                <Footer />
            </LanguageProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'KG' }));
        expect(screen.getByRole('link', { name: 'Бизнести кошуу' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Бизнеске кошулуу арызы' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'EN' }));
        expect(screen.getByRole('link', { name: 'Connect a business' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Join a business' })).toBeTruthy();
    });
});
