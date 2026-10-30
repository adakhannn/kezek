/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { SlotPicker } from '@/app/b/[slug]/components/SlotPicker';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { bookingRu } from '@/app/_components/i18n/dictionaries/booking.ru';
import { bookingKy } from '@/app/_components/i18n/dictionaries/booking.ky';
import { bookingEn } from '@/app/_components/i18n/dictionaries/booking.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

describe.each([
    ['ru', bookingRu, 'У вас уже есть запись на этот день', 'Активных записей в этом заведении на выбранный день: 2.'],
    ['ky', bookingKy, 'Бул күнгө жазылууңуз бар', 'Бул бизнесте тандалган күнгө активдүү жазылууларыңыз: 2.'],
    ['en', bookingEn, 'You already have a booking for this day', 'Active bookings in this business on the selected day: 2.'],
] as const)('existing visits notice %s', (locale, translations, title, many) => {
    const dictionary: Record<string, string> = translations;
    beforeEach(() => {
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    });
    function renderCount(count: number) {
        render(<SlotPicker slots={[]} selectedSlot={null} onSelect={jest.fn()} loading={false} error={null}
            dayStr="2026-10-19" dayLabel="19 Oct" staffId="staff" staff={[]} serviceId="service"
            servicesFiltered={[{ id: 'service' }]} serviceStaff={[]} isAuthed clientBookingsCount={count}
            clientBookingsLoading={false} bookingLoading={false} />);
    }
    test('shows exact multiple-visit count without losing the translated heading', () => {
        renderCount(2);
        expect(screen.getByText(title, { exact: true })).toBeTruthy();
        expect(screen.getByText(many, { exact: true })).toBeTruthy();
        expect(screen.queryByText(/\{count\}/)).toBeNull();
    });
    test('preserves the single-visit message', () => {
        renderCount(1);
        expect(screen.getByText(title, { exact: true })).toBeTruthy();
        expect(screen.getByText(dictionary['booking.existingBookings.warning.one'], { exact: true })).toBeTruthy();
    });
    test('does not show the notice for zero visits', () => {
        renderCount(0);
        expect(screen.queryByText(title, { exact: true })).toBeNull();
        expect(screen.queryByText(dictionary['booking.existingBookings.warning.one'], { exact: true })).toBeNull();
    });
});
