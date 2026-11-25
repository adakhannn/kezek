/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import BookingCard from '@/app/cabinet/components/BookingCard';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/MapDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/RescheduleDialog', () => ({
    __esModule: true,
    default: ({ booking }: { booking: { staffId: string; durationMin: number } }) => (
        <div role="dialog" aria-label="reschedule">{`${booking.staffId}:${booking.durationMin}`}</div>
    ),
}));

const t = (key: string, fallback?: string) => (ru as Record<string, string>)[key] ?? fallback ?? key;
const ids = {
    staff: { id: 'staff-1', full_name: 'Master' },
    branch: { id: 'branch-1', name: 'Branch', lat: null, lon: null, address: null },
    business: { id: 'biz-1', name: 'Biz', slug: 'biz', tz: 'Asia/Bishkek' },
};

beforeEach(() => {
    jest.mocked(useLanguage).mockReturnValue({ locale: 'ru', t } as ReturnType<typeof useLanguage>);
});

function card(props: { start: string; end: string; status?: 'confirmed' | 'hold'; promotionApplied?: Record<string, unknown> | null }) {
    render(<BookingCard bookingId="booking-1" status={props.status ?? 'confirmed'} start_at={props.start} end_at={props.end}
        service={{ id: 'service-1', name_ru: 'Cut', duration_min: 45 }} {...ids} canCancel promotionApplied={props.promotionApplied ?? null} />);
}

const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

test('a started booking hides cancel and reschedule and explains why (R25-10)', () => {
    card({ start: at(-10), end: at(35) });
    expect(screen.queryByRole('button', { name: ru['cabinet.bookings.card.actions.cancel'], exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['cabinet.bookings.card.actions.reschedule'], exact: true })).toBeNull();
    expect(screen.getByTestId('booking-started-notice').textContent).toBe(ru['cabinet.bookings.card.startedNotice']);
});

test('a future confirmed booking offers reschedule for the booked duration', () => {
    card({ start: at(120), end: at(170) });
    expect(screen.getByRole('button', { name: ru['cabinet.bookings.card.actions.cancel'], exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ru['cabinet.bookings.card.actions.reschedule'], exact: true }));
    expect(screen.getByRole('dialog', { name: 'reschedule' }).textContent).toBe('staff-1:50');
    expect(screen.queryByTestId('booking-started-notice')).toBeNull();
});

test('a booking with a promotion is rescheduled by the business', () => {
    card({ start: at(120), end: at(165), promotionApplied: { promotion_type: 'x' } });
    expect(screen.queryByRole('button', { name: ru['cabinet.bookings.card.actions.reschedule'], exact: true })).toBeNull();
    expect(screen.getByText(ru['cabinet.bookings.card.benefitRescheduleNotice'])).toBeTruthy();
});

test('a pending hold can be cancelled but not rescheduled', () => {
    card({ start: at(120), end: at(165), status: 'hold' });
    expect(screen.getByRole('button', { name: ru['cabinet.bookings.card.actions.cancel'], exact: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: ru['cabinet.bookings.card.actions.reschedule'], exact: true })).toBeNull();
});
