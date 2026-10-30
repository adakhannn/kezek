/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthChoiceModal } from '@/app/b/[slug]/components/AuthChoiceModal';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';

test.each([['ru', ru], ['en', en], ['ky', ky]] as const)('translates booking method explanations and preserves actions in %s', (_locale, dictionary) => {
    const onClose = jest.fn();
    const onAuth = jest.fn();
    const onGuestBooking = jest.fn();
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    render(<AuthChoiceModal isOpen onClose={onClose} onAuth={onAuth} onGuestBooking={onGuestBooking} t={t} slotTimeLabel="09:00" />);
    for (const suffix of ['selectedSlot', 'authBadge', 'authHint', 'guestBadge', 'guestHint', 'footerHint']) {
        const key = `booking.authChoice.${suffix}`;
        expect(dictionary[key]).toBeTruthy();
        expect(screen.getByText(dictionary[key])).toBeTruthy();
    }
    expect(screen.getByText('09:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: new RegExp(dictionary['booking.authChoice.authButton'])}));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(onGuestBooking).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: new RegExp(dictionary['booking.authChoice.guestButton'])}));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onGuestBooking).toHaveBeenCalledTimes(1);
});
