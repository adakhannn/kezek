/** @jest-environment jsdom */
import { act, render, renderHook, screen } from '@testing-library/react';
import { GuestBookingModal } from '@/app/b/[slug]/components/GuestBookingModal';
import { useGuestBooking } from '@/app/b/[slug]/hooks/useGuestBooking';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';

jest.mock('@/lib/quickBookGuestClient', () => ({ createGuestBookingRequest: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ getSessionId: jest.fn(), trackFunnelEvent: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

describe.each([['ru', ru], ['en', en], ['ky', ky]] as const)('guest booking in %s', (_locale, dictionary) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    test('translates all context and field hints', () => {
        render(<GuestBookingModal isOpen loading={false} form={{ client_name: '', client_phone: '', client_email: '' }}
            onClose={jest.fn()} onFormChange={jest.fn()} onSubmit={jest.fn()} t={t} slotTimeLabel="09:00" />);
        for (const suffix of ['selectedSlot', 'info', 'nameHelper', 'phoneHelper', 'emailHelper']) {
            expect(dictionary[`booking.guest.${suffix}`]).toBeTruthy();
            expect(screen.getByText(t(`booking.guest.${suffix}`))).toBeTruthy();
        }
    });
    test.each([
        ['', '', '', 'nameRequired'],
        ['L', '', '', 'nameInvalid'],
        ['LIVE TEST', '', '', 'phoneRequired'],
        ['LIVE TEST', 'abc', '', 'phoneInvalid'],
        ['LIVE TEST', '+996555123456', 'bad-email', 'emailInvalid'],
    ])('rejects invalid local contacts with translated %s/%s/%s', async (name, phone, email, key) => {
        const showError = jest.fn();
        const { result } = renderHook(() => useGuestBooking({bizId: 'biz', branchId: 'branch', staffId: 'staff',
            services: [{id: 'service', branch_id: 'branch', name_ru: 'Test', duration_min: 60, price_from: 100, price_to: 300}],
            t, feedback: {showError}}));
        act(() => {
            result.current.openModal(new Date('2026-10-12T03:00:00Z'));
            result.current.setForm({client_name: name, client_phone: phone, client_email: email});
        });
        await act(async () => { await result.current.createGuestBooking(); });
        expect(showError).toHaveBeenCalledWith(t(`booking.guest.${key}`));
        expect(createGuestBookingRequest).not.toHaveBeenCalled();
        expect(result.current.modalOpen).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.form).toEqual({client_name: name, client_phone: phone, client_email: email});
    });
});
