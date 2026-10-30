/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import RouteLoading from '@/app/loading';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

it.each(['ru', 'en', 'ky'] as const)('announces route loading without blocking controls in %s', locale => {
    const dictionary = { ru, en, ky }[locale];
    (useLanguage as jest.Mock).mockReturnValue({ locale, t: (key: string) => dictionary[key] ?? key });
    render(<RouteLoading />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(dictionary['common.loading']);
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(status.querySelector('[aria-hidden="true"]')).toBeTruthy();
});
