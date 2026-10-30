/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import ClientCabinet from '@/app/cabinet/ClientCabinet';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { cabinetRu } from '@/app/_components/i18n/dictionaries/cabinet.ru';
import { cabinetKy } from '@/app/_components/i18n/dictionaries/cabinet.ky';
import { cabinetEn } from '@/app/_components/i18n/dictionaries/cabinet.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/BookingCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/MyVisitPackagesBlock', () => ({ __esModule: true, default: () => null }));

test.each([
    ['ru', cabinetRu, 0, 'many'],
    ['ru', cabinetRu, 1, 'one'],
    ['ru', cabinetRu, 21, 'one'],
    ['ru', cabinetRu, 22, 'few'],
    ['ky', cabinetKy, 0, 'many'],
    ['en', cabinetEn, 0, 'many'],
] as const)('renders %s upcoming count %s using %s', (locale, dictionary, count, form) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) =>
        (dictionary as Record<string, string>)[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    const upcoming = Array.from({ length: count }, (_, index) => ({
        id: String(index), status: 'confirmed' as const,
        start_at: '2026-10-12T03:00:00Z', end_at: '2026-10-12T04:00:00Z',
    }));
    render(<ClientCabinet userId="test-user" upcoming={upcoming} past={[]} />);
    expect(screen.getByText(dictionary[`cabinet.bookings.subtitle.upcoming.${form}`].replace('{count}', String(count)))).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: dictionary['cabinet.bookings.tabs.past'] }));
    expect(screen.getByText(dictionary['cabinet.bookings.subtitle.past.many'].replace('{count}', '0'))).toBeTruthy();
});
