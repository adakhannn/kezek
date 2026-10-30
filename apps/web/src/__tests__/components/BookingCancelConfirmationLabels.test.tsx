/** @jest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import BookingCard from '@/app/cabinet/components/BookingCard';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/cabinet/components/MapDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/ReviewDialog', () => ({ __esModule: true, default: () => null }));

const cases = [
    ['ru', ru, 'Оставить запись', 'Отменить запись'],
    ['en', en, 'Keep booking', 'Cancel booking'],
    ['ky', ky, 'Жазылууну сактап калуу', 'Жазылууну жокко чыгаруу'],
] as const;

describe.each(cases)('booking cancellation confirmation %s', (locale, dictionary, keepLabel, confirmLabel) => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    });
    afterEach(() => jest.restoreAllMocks());

    function openPreview() {
        render(<BookingCard bookingId="fixture-confirmation" status="confirmed" start_at="2026-10-19T03:00:00Z" end_at="2026-10-19T04:00:00Z" service={null} staff={null} branch={null} business={null} canCancel />);
        const trigger = screen.getByRole('button', { name: dictionary['cabinet.bookings.card.actions.cancel'], exact: true });
        trigger.focus();
        fireEvent.click(trigger);
        return { trigger, dialog: screen.getByRole('dialog', { name: dictionary['cabinet.bookings.card.cancelConfirmTitle'], exact: true }) };
    }

    it('distinguishes keeping the booking from destructive confirmation', () => {
        const { dialog } = openPreview();
        expect(within(dialog).getByRole('button', { name: keepLabel, exact: true })).not.toBe(within(dialog).getByRole('button', { name: confirmLabel, exact: true }));
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('keeps the booking without sending a cancellation request', () => {
        const { trigger, dialog } = openPreview();
        fireEvent.click(within(dialog).getByRole('button', { name: keepLabel, exact: true }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Escape closes only the preview and restores its trigger', () => {
        const { trigger } = openPreview();
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
