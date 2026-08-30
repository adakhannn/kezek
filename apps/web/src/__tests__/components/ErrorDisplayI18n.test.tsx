/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { ErrorDisplay } from '@/app/_components/ErrorDisplay';
import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';

describe('ErrorDisplay localization', () => {
    beforeEach(() => {
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    it('localizes the imperative reload action', async () => {
        render(
            <LanguageProvider>
                <ErrorDisplay errorType="SERVICE_UNAVAILABLE" context="dashboard" />
            </LanguageProvider>,
        );

        expect(await screen.findByRole('button', { name: 'Reload page' })).toBeTruthy();
    });
});
