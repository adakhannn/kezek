/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { bookingsEn } from '@/app/_components/i18n/dictionaries/bookings.en';
import { bookingsKy } from '@/app/_components/i18n/dictionaries/bookings.ky';
import { bookingsRu } from '@/app/_components/i18n/dictionaries/bookings.ru';
import { CalendarDaySection } from '@/app/dashboard/bookings/components/BookingsViewSections';

type CalendarFixture = {
    id: string; staff_id: string; start_at: string; end_at: string; status: 'confirmed';
    booking_services?: { duration_min: number; service: { name_ru: string; name_en: string; name_ky: string } }[];
};
let mockCalendarRows: CalendarFixture[] = [];
beforeEach(() => {
    mockCalendarRows = [];
    window.history.replaceState(null, '');
});

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({
    supabase: { from: () => ({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(), order: () => Promise.resolve({ data: mockCalendarRows, error: null }),
    }) },
}));

const cases = [
    ['ru', bookingsRu, 'Фильтр по филиалу', 'Дата календаря'],
    ['en', bookingsEn, 'Branch filter', 'Calendar date'],
    ['ky', bookingsKy, 'Филиал боюнча чыпка', 'Календардын датасы'],
] as const;
const props = {
    bizId: 'business-1', timezone: 'Asia/Bishkek', staff: [],
    branches: [{ id: 'branch-1', name: 'Филиал 1' }, { id: 'branch-2', name: 'Филиал 2' }],
};

function setLanguage(locale: 'ru' | 'en' | 'ky', dictionary: Record<string, string>) {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
}

test.each(cases)('localizes the actual owner calendar branch control in %s', async (locale, dictionary, branchLabel) => {
    setLanguage(locale, dictionary);
    render(<CalendarDaySection {...props} />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: branchLabel, exact: true })).toBeTruthy());
});

test.each(cases)('localizes the actual owner calendar date control in %s', async (locale, dictionary, _branchLabel, dateLabel) => {
    setLanguage(locale, dictionary);
    render(<CalendarDaySection {...props} />);
    await waitFor(() => expect(screen.getByLabelText(dateLabel, { exact: true })).toBeTruthy());
});

test.each(cases)('retains date and authored branch selection when switching to %s', async (locale, dictionary, branchLabel, dateLabel) => {
    setLanguage('ru', bookingsRu);
    const view = render(<CalendarDaySection {...props} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'branch-2' } });
    fireEvent.change(screen.getByLabelText('Дата календаря'), { target: { value: '2026-10-19' } });
    setLanguage(locale, dictionary);
    view.rerender(<CalendarDaySection {...props} />);
    await waitFor(() => {
        expect(screen.getByRole('combobox', { name: branchLabel, exact: true })).toHaveProperty('value', 'branch-2');
        expect(screen.getByLabelText(dateLabel, { exact: true })).toHaveProperty('value', '2026-10-19');
    });
    expect(screen.getByRole('option', { name: 'Филиал 2', exact: true })).toHaveProperty('selected', true);
});

const bookingFixture: CalendarFixture = {
    id: '14c108f6-fixture', staff_id: 'staff-1', status: 'confirmed',
    start_at: '2026-10-19T09:00:00Z', end_at: '2026-10-19T10:00:00Z',
};
const calendarStaff = [{ id: 'staff-1', full_name: 'Authored staff', branch_id: 'branch-1' }];

test.each(cases)('localizes an owner calendar booking fallback tooltip in %s', async (locale, dictionary) => {
    setLanguage(locale, dictionary);
    mockCalendarRows = [bookingFixture];
    render(<CalendarDaySection {...props} staff={calendarStaff} />);
    const link = await screen.findByRole('link', { name: '15:00–16:00', exact: true });
    expect(link.getAttribute('title')).toBe(`${dictionary['bookings.calendar.openBooking']} #14c108f6`);
    expect(link.getAttribute('href')).toBe('/booking/14c108f6-fixture');
});

test.each(cases)('preserves authored service tooltip rather than replacing it with a generic action in %s', async (locale, dictionary) => {
    setLanguage(locale, dictionary);
    const service = { name_ru: 'Авторская услуга', name_en: 'Authored service', name_ky: 'Автордук кызмат' };
    mockCalendarRows = [{ ...bookingFixture, booking_services: [{ duration_min: 60, service }] }];
    render(<CalendarDaySection {...props} staff={calendarStaff} />);
    const link = await screen.findByRole('link', { name: '15:00–16:00', exact: true });
    expect(link.getAttribute('title')).toContain(service[`name_${locale}`]);
    expect(link.getAttribute('title')).not.toContain(`#14c108f6`);
    expect(link.getAttribute('href')).toBe('/booking/14c108f6-fixture');
});
