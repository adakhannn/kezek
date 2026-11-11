/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { SlotPicker } from '@/app/b/[slug]/components/SlotPicker';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
const slots = ['staff-a', 'staff-b'].map(staff_id => ({ staff_id, branch_id: 'branch', start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z' }));
const props = { slots, selectedSlot: null, onSelect: jest.fn(), loading: false, error: null,
    dayStr: '2035-01-01', dayLabel: '1 Jan', staffId: 'any',
    staff: [{ id: 'staff-a', full_name: 'First Staff', branch_id: 'branch', rating_score: null }, { id: 'staff-b', full_name: 'Second Staff', branch_id: 'branch', rating_score: null }],
    serviceId: 'service', servicesFiltered: [{ id: 'service' }], serviceStaff: null,
    isAuthed: false, clientBookingsCount: null, clientBookingsLoading: false, bookingLoading: false,
    hasMore: true, onLoadMore: jest.fn(),
};
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLanguage).mockReturnValue({ locale: 'en', t: (key: string, fallback?: string) => en[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
});
test('equal times retain each staff name and select the clicked staff identity', () => {
    render(<SlotPicker {...props} />);
    const buttons = screen.getAllByTestId('time-slot');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('First Staff');
    expect(buttons[1].textContent).toContain('Second Staff');
    fireEvent.click(buttons[1]);
    expect(props.onSelect).toHaveBeenCalledWith(new Date(slots[1].start_at), 'staff-b');
});
test.each(['ru', 'en', 'ky'] as const)('empty intermediate pages show localized continuation without false no-slots claim (%s)', locale => {
    const dictionary = { ru, en, ky }[locale];
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    const view = render(<SlotPicker {...props} slots={[]} />);
    expect(screen.queryByText(dictionary['booking.empty.noSlotsTitle'] ?? 'Свободных слотов пока нет')).toBeNull();
    expect(screen.getByText(dictionary['booking.slots.partial'])).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: dictionary['booking.slots.loadMore'] }));
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    view.rerender(<SlotPicker {...props} slots={[]} loadingMore />);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});
test('next-page error keeps already loaded choices visible', () => {
    render(<SlotPicker {...props} moreError="Retry this page" />);
    expect(screen.getAllByTestId('time-slot')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toContain('Retry this page');
    expect(screen.getByRole('button', { name: en['booking.slots.loadMore'] })).toBeTruthy();
});
