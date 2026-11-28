/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import BookingLayoutClient from '@/app/booking/[id]/BookingLayoutClient';
import BookingCard from '@/app/cabinet/components/BookingCard';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/MapDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({ __esModule: true, default: () => null }));

test.each([
    ['ru', '19 окт. • 02:15–03:15'], ['ky', '19-октябрь • 02:15–03:15'], ['en', 'Oct 19 • 02:15–03:15'],
] as const)('receipt writes the %s visit in the owner format and the Bishkek timezone', (locale, expected) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (_key: string, fallback?: string) => fallback ?? '' } as ReturnType<typeof useLanguage>);
    jest.useFakeTimers({ now: new Date('2026-11-28T06:00:00Z') });
    // UTC previous day: guards against accidentally switching the visit date/timezone.
    render(<BookingLayoutClient services={null} masterName="Test" startAt={new Date('2026-10-18T20:15:00Z')}
        endAt={new Date('2026-10-18T21:15:00Z')} status="confirmed" />);
    jest.useRealTimers();
    expect(screen.getByText(expected)).toBeTruthy();
});

test.each([
    ['ru', 'ru-RU'], ['ky', 'ky-KG'], ['en', 'en-US'],
] as const)('own booking card formats %s date using the same locale and timezone', (locale, intlLocale) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (_key: string, fallback?: string) => fallback ?? '' } as ReturnType<typeof useLanguage>);
    const start = '2026-10-18T20:15:00Z';
    render(<BookingCard bookingId="card-date" status="no_show" start_at={start} end_at="2026-10-18T21:15:00Z" service={null} staff={null} branch={null} business={null} canCancel={false} />);
    const expected = new Intl.DateTimeFormat(intlLocale, {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek',
    }).format(new Date(start));
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
});
