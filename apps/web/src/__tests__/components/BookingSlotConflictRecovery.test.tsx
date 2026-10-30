/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useBookingCreation } from '@/app/b/[slug]/hooks/useBookingCreation';
import { fmtErr } from '@/app/b/[slug]/utils';
import { createQuickHoldBooking, QuickHoldClientError } from '@/lib/quickHoldClient';
import { bookingRu } from '@/app/_components/i18n/dictionaries/booking.ru';
import { bookingKy } from '@/app/_components/i18n/dictionaries/booking.ky';
import { bookingEn } from '@/app/_components/i18n/dictionaries/booking.en';
jest.mock('@/lib/quickHoldClient', () => ({ ...jest.requireActual('@/lib/quickHoldClient'), createQuickHoldBooking: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ trackFunnelEvent: jest.fn(), getSessionId: jest.fn() }));

test.each([bookingRu, bookingKy, bookingEn])('uses a translated conflict message without details', dictionary => {
    const error = new QuickHoldClientError('technical backend text', { code: 'booking_slot_unavailable', status: 409, details: { private: 'debug' } });
    expect(fmtErr(error, key => (dictionary as Record<string, string>)[key])).toBe(dictionary['booking.error.slotUnavailable']);
});

test('invalidates the selected slot without retrying or reporting booking success', async () => {
    jest.mocked(createQuickHoldBooking).mockRejectedValue(new QuickHoldClientError('Slot unavailable', { code: 'booking_slot_unavailable', status: 409 }));
    const invalidated = jest.fn();
    const success = jest.fn();
    const showError = jest.fn();
    const { result } = renderHook(() => useBookingCreation({
        bizId: 'biz', branchId: 'branch', staffId: 'staff', isAuthed: true,
        services: [{ id: 'service', branch_id: 'branch', name_ru: 'Test', duration_min: 60, price_from: 100, price_to: 300 }],
        t: (key, fallback) => (bookingRu as Record<string, string>)[key] ?? fallback ?? key,
        feedback: { showError }, onAuthChoiceRequest: jest.fn(), onSlotUnavailable: invalidated, onBookingCreated: success,
    }));
    await act(async () => { await result.current.createBooking(new Date('2026-10-12T03:00:00Z')); });
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
    expect(createQuickHoldBooking).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith(bookingRu['booking.error.slotUnavailable']);
    expect(result.current.loading).toBe(false);
});
