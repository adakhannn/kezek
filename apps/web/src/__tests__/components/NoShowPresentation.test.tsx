/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import BookingCard from '@/app/cabinet/components/BookingCard';
import BookingLayoutClient from '@/app/booking/[id]/BookingLayoutClient';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { cabinetRu } from '@/app/_components/i18n/dictionaries/cabinet.ru';
import { cabinetKy } from '@/app/_components/i18n/dictionaries/cabinet.ky';
import { cabinetEn } from '@/app/_components/i18n/dictionaries/cabinet.en';
import { bookingRu } from '@/app/_components/i18n/dictionaries/booking.ru';
import { bookingKy } from '@/app/_components/i18n/dictionaries/booking.ky';
import { bookingEn } from '@/app/_components/i18n/dictionaries/booking.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/MapDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({ __esModule: true, default: () => null }));

const locales = [
    ['ru', { ...cabinetRu, ...bookingRu }, 'Неявка'],
    ['ky', { ...cabinetKy, ...bookingKy }, 'Келген жок'],
    ['en', { ...cabinetEn, ...bookingEn }, 'No-show'],
] as const;

function setLanguage(locale: 'ru' | 'ky' | 'en', dictionary: Record<string, string>) {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
}

test.each(locales)('receipt localizes no-show in %s', (locale, dictionary, label) => {
    setLanguage(locale, dictionary);
    render(<BookingLayoutClient id="no-show" services={null} masterName="Test" startAt={new Date('2026-10-12T10:15:00Z')} status="no_show" />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText('no_show')).toBeNull();
});

describe.each(locales)('no-show card in %s', (locale, dictionary, label) => {
    test.each([true, false])('terminal actions stay unavailable even when canCancel=%s is supplied', canCancel => {
        setLanguage(locale, dictionary);
        render(<BookingCard bookingId="no-show" status="no_show" start_at="2026-10-12T10:15:00Z" end_at="2026-10-12T11:15:00Z" service={null} staff={null} branch={null} business={null} canCancel={canCancel} />);
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: dictionary['cabinet.bookings.card.actions.cancel'], exact: true })).toBeNull();
        expect(screen.queryByRole('button', { name: dictionary['cabinet.bookings.card.actions.review'], exact: true })).toBeNull();
    });
});

test('keeps package name quotation marks and amount unchanged after JSX lint repair', () => {
    setLanguage('ru', { ...cabinetRu, ...bookingRu });
    render(<BookingCard bookingId="paid-package" status="paid" start_at="2026-10-12T10:15:00Z" end_at="2026-10-12T11:15:00Z"
        service={null} staff={null} branch={null} business={null} canCancel={false}
        subscriptionApplied={{ plan_name_ru: 'Fixture plan', final_amount: 200 }} />);
    expect(screen.getByText('Оплачено пакетом: "Fixture plan"', { exact: false })).toBeTruthy();
    expect(screen.getByText(/200 сом/)).toBeTruthy();
});
