/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import BusinessPageState from '@/app/b/[slug]/BusinessPageState';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value,
    });
}

describe('BusinessPageState', () => {
    beforeEach(() => {
        refresh.mockReset();
        setOnline(true);
        window.localStorage.clear();
        document.cookie = 'kezek_lang=; max-age=0; path=/';
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    it('shows a real not-found state with recovery actions while online', async () => {
        render(
            <LanguageProvider>
                <BusinessPageState kind="not-found" />
            </LanguageProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Business not found' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'Back to catalog' }).getAttribute('href')).toBe('/');
    });

    it('reclassifies the state as unavailable offline and refreshes when connectivity returns', async () => {
        setOnline(false);

        render(
            <LanguageProvider>
                <BusinessPageState kind="not-found" />
            </LanguageProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Could not load the business' })).toBeTruthy();
        expect(refresh).not.toHaveBeenCalled();

        setOnline(true);
        act(() => window.dispatchEvent(new Event('online')));

        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });
});
