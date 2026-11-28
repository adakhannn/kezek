/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import BookingLayoutClient from '@/app/booking/[id]/BookingLayoutClient';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

const dictionaries = { ru, ky, en } as const;
type Locale = keyof typeof dictionaries;

function setLanguage(locale: Locale) {
    const dictionary = dictionaries[locale] as Record<string, string>;
    jest.mocked(useLanguage).mockReturnValue({
        locale,
        t: (key: string, fallback?: string) => dictionary[key] ?? ru[key as keyof typeof ru] ?? fallback ?? key,
    } as ReturnType<typeof useLanguage>);
}

const NOW = new Date('2026-11-26T06:00:00Z');
// 27 Nov 2026, 10:00–11:00 in Bishkek.
const FUTURE = { startAt: new Date('2026-11-27T04:00:00Z'), endAt: new Date('2026-11-27T05:00:00Z') };
// Started an hour ago and not over yet.
const STARTED = { startAt: new Date('2026-11-26T05:00:00Z'), endAt: new Date('2026-11-26T07:00:00Z') };

function renderDetails(props: Partial<ComponentProps<typeof BookingLayoutClient>> = {}) {
    return render(
        <BookingLayoutClient
            services={[{ name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 60 }]}
            masterName="Айгуль"
            status="confirmed"
            branch={{ name: 'Филиал Центр', address: 'ул. Ленина, 1' }}
            viewer="client"
            {...FUTURE}
            {...props}
        />,
    );
}

beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    setLanguage('ru');
});
afterEach(() => jest.useRealTimers());

describe('booking details page (M2)', () => {
    test('titles the page «Запись» and shows no booking id', () => {
        const { container } = renderDetails();
        expect(screen.getByRole('heading', { level: 1, name: 'Запись' })).toBeTruthy();
        expect(container.textContent).not.toMatch(/Бронь|ID:|#[0-9a-f]{6}/);
    });

    test('shows the visit in the owner format, the branch and its address', () => {
        renderDetails();
        expect(screen.getByText('27 нояб. • 10:00–11:00')).toBeTruthy();
        expect(screen.getByText('Филиал Центр')).toBeTruthy();
        expect(screen.getByText('ул. Ленина, 1')).toBeTruthy();
    });

    test('hides the branch row when the booking carries no branch (public receipt)', () => {
        renderDetails({ branch: null, viewer: 'guest' });
        expect(screen.queryByText(ru['booking.details.branch'])).toBeNull();
    });

    test('a client with a future confirmed booking is sent to «Мои записи» to cancel or reschedule', () => {
        renderDetails();
        expect(screen.getByTestId('booking-details-hint').textContent).toBe(ru['booking.details.manageHint']);
        expect(screen.getByRole('link', { name: 'Мои записи' }).getAttribute('href')).toBe('/cabinet/bookings');
        expect(screen.queryByText(ru['booking.contactHint'])).toBeNull();
    });

    test('a pending booking can only be cancelled by the client', () => {
        renderDetails({ status: 'hold' });
        expect(screen.getByTestId('booking-details-hint').textContent).toBe(ru['booking.details.cancelHint']);
    });

    test('a booking with a promotion is cancelled by the client and rescheduled by the business', () => {
        renderDetails({ promotionApplied: { promotion_type: 'first_visit_discount', promotion_title: 'Скидка' } });
        expect(screen.getByTestId('booking-details-hint').textContent).toBe(ru['booking.details.cancelHint']);
        expect(screen.getByText(ru['booking.details.benefitRescheduleNotice'])).toBeTruthy();
    });

    test('a started booking says only the business can change it', () => {
        renderDetails(STARTED);
        expect(screen.getByTestId('booking-details-hint').textContent).toBe(ru['booking.details.startedNotice']);
    });

    test.each(['paid', 'cancelled', 'no_show'])('a %s booking shows no cancellation hint', (status) => {
        renderDetails({ status });
        expect(screen.queryByTestId('booking-details-hint')).toBeNull();
    });

    test('staff reading the booking get no client hints and go home', () => {
        renderDetails({ viewer: 'staff' });
        expect(screen.queryByTestId('booking-details-hint')).toBeNull();
        expect(screen.getByRole('link', { name: ru['booking.goHome'] }).getAttribute('href')).toBe('/');
    });

    test('a guest with an upcoming booking is told to contact the salon', () => {
        renderDetails({ viewer: 'guest' });
        expect(screen.getByTestId('booking-details-hint').textContent).toBe(ru['booking.contactHint']);
        expect(screen.queryByRole('link', { name: 'Мои записи' })).toBeNull();
    });

    test.each([
        ['ky', 'Жазылыш', '27-ноябрь • 10:00–11:00', 'Менин жазылыштарым'],
        ['en', 'Booking', 'Nov 27 • 10:00–11:00', 'My bookings'],
    ] as const)('%s: the same page in the visitor language', (locale, title, when, back) => {
        setLanguage(locale);
        renderDetails();
        expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
        expect(screen.getByText(when)).toBeTruthy();
        expect(screen.getByRole('link', { name: back })).toBeTruthy();
    });
});
