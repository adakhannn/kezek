/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { SignOutButton } from '@/app/_components/SignOutButton';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { signOut: jest.fn(async () => ({})) } } }));

// H6: below sm only the icon is visible, so the button needs its own accessible name.
test.each([
    ['ru', ru],
    ['ky', ky],
    ['en', en],
] as const)('the sign-out button is named in %s', (locale, dictionary) => {
    jest.mocked(useLanguage).mockReturnValue({
        locale,
        t: (key: string, fallback?: string) => (dictionary as Record<string, string>)[key] ?? fallback ?? key,
    } as ReturnType<typeof useLanguage>);
    render(<SignOutButton />);
    expect(screen.getByRole('button', { name: dictionary['header.signOut'] })).toBeTruthy();
});
