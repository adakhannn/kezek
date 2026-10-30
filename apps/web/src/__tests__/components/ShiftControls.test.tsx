/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { ShiftControls } from '@/app/staff/finance/components/ShiftControls';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (key: string, fallback: string) => staffRu[key as keyof typeof staffRu] ?? fallback }),
}));

const base = {
    hasShift: false, isOpen: false, isClosed: false, isDayOff: false,
    loading: false, saving: false, onOpenShift: jest.fn(), onCloseShift: jest.fn(), onRefresh: jest.fn(),
};

it('explains a day off without offering shift opening', () => {
    render(<ShiftControls {...base} isDayOff />);
    expect(screen.getByText(staffRu['staff.finance.shift.dayOff'])).toBeTruthy();
    expect(screen.queryByRole('button', {name:'Открыть смену'})).toBeNull();
});

it('opens an available workday through the supplied action', () => {
    render(<ShiftControls {...base} />);
    fireEvent.click(screen.getByRole('button', {name:'Открыть смену'}));
    expect(base.onOpenShift).toHaveBeenCalledTimes(1);
});

it('does not allow opening before authoritative availability has loaded', () => {
    render(<ShiftControls {...base} loading />);
    expect((screen.getByRole('button', {name:'Открыть смену'}) as HTMLButtonElement).disabled).toBe(true);
});

it('keeps an existing open shift actionable even if schedule later becomes a day off', () => {
    render(<ShiftControls {...base} hasShift isOpen isDayOff />);
    expect(screen.queryByText(staffRu['staff.finance.shift.dayOff'])).toBeNull();
    expect(screen.getByRole('button', {name:'Закрыть смену'})).toBeTruthy();
});

it('keeps the existing closed-shift reopening control', () => {
    render(<ShiftControls {...base} hasShift isClosed />);
    expect(screen.getByRole('button', {name:staffRu['staff.finance.shift.reopen']})).toBeTruthy();
    expect(screen.queryByRole('button', {name:'Открыть смену'})).toBeNull();
});
