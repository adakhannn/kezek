/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageSwitcher } from '@/app/_components/i18n/LanguageSwitcher';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: jest.fn(),
}));

const setLocale = jest.fn();

describe('LanguageSwitcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useLanguage as jest.Mock).mockReturnValue({
            locale: 'ru',
            setLocale,
            t: (key: string, fallback?: string) => (
                key === 'header.language' ? 'Язык' : (fallback ?? key)
            ),
        });
    });

    it('exposes the language group and current selection to assistive technologies', () => {
        render(<LanguageSwitcher />);

        expect(screen.getByRole('group', { name: 'Язык' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Кыргызча' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('switches language and runs the optional close callback', () => {
        const onLanguageChange = jest.fn();
        render(<LanguageSwitcher onLanguageChange={onLanguageChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'English' }));

        expect(setLocale).toHaveBeenCalledWith('en');
        expect(onLanguageChange).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not refresh server components when the selected language is already active', () => {
        const onLanguageChange = jest.fn();
        render(<LanguageSwitcher onLanguageChange={onLanguageChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Русский' }));

        expect(setLocale).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(onLanguageChange).toHaveBeenCalledTimes(1);
    });
});
