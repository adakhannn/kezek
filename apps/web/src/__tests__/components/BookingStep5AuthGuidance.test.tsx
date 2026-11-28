/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { BookingFormSections } from '@/app/b/[slug]/components/BookingFormSections';

jest.mock('@/app/b/[slug]/components/BookingDateCalendar', () => ({ BookingDateCalendar: () => null }));
jest.mock('@/app/b/[slug]/components/BookingSummary', () => ({ BookingSummary: () => null }));
jest.mock('@/app/b/[slug]/components/SlotPicker', () => ({ SlotPicker: () => null }));

describe.each([['ru', ru], ['en', en], ['ky', ky]] as const)('step5 identity guidance %s', (_locale, dictionary) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;

    function props(isAuthed: boolean): ComponentProps<typeof BookingFormSections> {
        return {
            bizId: 'biz', branchId: 'branch', branches: [], branchPromotions: [], businessTz: 'Asia/Bishkek',
            canGoNext: false, canGoPrev: true, clientBookingsCount: isAuthed ? 5 : null, clientBookingsLoading: false,
            createBooking: jest.fn(), day: new Date('2026-10-19T03:00:00Z'), dayLabel: '19Oct', dayStr: '2026-10-19',
            formatBranchName: name => name, goNext: jest.fn(), goPrev: jest.fn(), isAuthed, bookingLoading: false,
            serviceCurrent: null, serviceId: '', serviceIds: [], serviceStaff: [], servicesFiltered: [],
            selectedServicesForStep4: [], slots: [], slotsError: null, slotsLoading: false,
            staff: [], staffCurrent: null, staffFiltered: [], staffId: '', step: 5, t,
            totalDurationStep4: 0, totalPriceFromStep4: 0, totalPriceToStep4: 0, totalSteps: 5,
            onBranchSelect: jest.fn(), onDayChange: jest.fn(), onServiceToggle: jest.fn(), onSlotSelect: jest.fn(),
            onStaffSelect: jest.fn(), onRetrySlots: jest.fn(),
        };
    }

    it('does not ask an authenticated client to sign in', () => {
        const input = props(true);
        render(<BookingFormSections {...input} />);
        expect(screen.getByRole('heading', { name: dictionary['booking.step5.title'] })).toBeTruthy();
        expect(screen.queryByText(dictionary['booking.flow.step5Description'], { exact: true })).toBeNull();
        expect(input.onSlotSelect).not.toHaveBeenCalled();
        expect(input.createBooking).not.toHaveBeenCalled();
    });

    it('retains guest guidance and drops it once identity becomes authenticated', () => {
        const guest = props(false);
        const view = render(<BookingFormSections {...guest} />);
        expect(screen.getByText(dictionary['booking.flow.step5Description'], { exact: true })).toBeTruthy();
        view.rerender(<BookingFormSections {...guest} isAuthed />);
        expect(screen.queryByText(dictionary['booking.flow.step5Description'], { exact: true })).toBeNull();
        expect(guest.onSlotSelect).not.toHaveBeenCalled();
        expect(guest.createBooking).not.toHaveBeenCalled();
    });

    it('names the step once: no «Шаг N» kicker or step intro card above the step', () => {
        const { container } = render(<BookingFormSections {...props(false)} />);
        expect(container.textContent).not.toMatch(/Шаг \d|Step \d|Кадам \d/);
    });
});
