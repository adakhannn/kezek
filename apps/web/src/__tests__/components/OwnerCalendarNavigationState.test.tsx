/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { CalendarDaySection } from '@/app/dashboard/bookings/components/BookingsViewSections';

const mockCalendarT = (_key: string, fallback: string) => fallback;
jest.mock('@/lib/time', () => ({
    ...jest.requireActual('@/lib/time'), todayStringInTz: () => '2026-10-17',
}));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: mockCalendarT }),
}));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(),
    order: () => Promise.resolve({ data: [], error: null }),
}) } }));

const props = {
    bizId: 'business-1', timezone: 'Asia/Bishkek', staff: [],
    branches: [{ id: 'branch-1', name: 'Branch 1' }, { id: 'branch-2', name: 'Branch 2' }],
};

beforeEach(() => window.history.replaceState({ __NA: true, keep: 'next-state' }, ''));
afterEach(() => window.history.replaceState(null, ''));

test.each(['all', 'branch-1', 'branch-2'])('restores the same history entry day and branch %s after receipt remount', async (branchId) => {
    const first = render(<CalendarDaySection {...props} />);
    fireEvent.change(screen.getByLabelText('Дата календаря'), { target: { value: '2026-10-19' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: branchId } });
    first.unmount();
    render(<CalendarDaySection {...props} />);
    await act(async () => {});
    expect(screen.getByLabelText('Дата календаря')).toHaveProperty('value', '2026-10-19');
    expect(screen.getByRole('combobox')).toHaveProperty('value', branchId);
    expect(window.history.state).toMatchObject({ __NA: true, keep: 'next-state' });
});

test('does not inherit another business calendar context', async () => {
    window.history.replaceState({ kezekBookingCalendar: { bizId: 'other', date: '2026-10-19', branchId: 'branch-1' } }, '');
    render(<CalendarDaySection {...props} />);
    await act(async () => {});
    expect(screen.getByLabelText('Дата календаря')).not.toHaveProperty('value', '2026-10-19');
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'all');
});

test('ignores a removed branch in restored history state', async () => {
    window.history.replaceState({ kezekBookingCalendar: { bizId: props.bizId, date: '2026-10-19', branchId: 'removed' } }, '');
    render(<CalendarDaySection {...props} />);
    await act(async () => {});
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'all');
});

test('ignores an invalid restored calendar date', async () => {
    window.history.replaceState({ kezekBookingCalendar: { bizId: props.bizId, date: '2026-02-30', branchId: 'all' } }, '');
    render(<CalendarDaySection {...props} />);
    await act(async () => {});
    expect(screen.getByLabelText('Дата календаря')).not.toHaveProperty('value', '2026-02-30');
});

test('reacts to a restored history entry without retaining the previous entry filters', async () => {
    render(<CalendarDaySection {...props} />);
    fireEvent.change(screen.getByLabelText('Дата календаря'), { target: { value: '2026-10-19' } });
    await act(async () => {
        window.history.replaceState({ kezekBookingCalendar: { bizId: props.bizId, date: '2026-10-20', branchId: 'branch-2' } }, '');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByLabelText('Дата календаря')).toHaveProperty('value', '2026-10-20');
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'branch-2');
});

test('does not keep filters when the actual business prop changes', async () => {
    const view = render(<CalendarDaySection {...props} />);
    fireEvent.change(screen.getByLabelText('Дата календаря'), { target: { value: '2026-10-19' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'branch-1' } });
    view.rerender(<CalendarDaySection {...props} bizId="business-2" />);
    await act(async () => {});
    expect(screen.getByLabelText('Дата календаря')).not.toHaveProperty('value', '2026-10-19');
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'all');
});
