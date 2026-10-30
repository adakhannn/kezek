/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useGuestBooking } from '@/app/b/[slug]/hooks/useGuestBooking';
import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';
import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';

jest.mock('@/lib/quickBookGuestClient', () => ({ createGuestBookingRequest: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ getSessionId: jest.fn(() => 'anonymous-session'), trackFunnelEvent: jest.fn().mockResolvedValue(undefined) }));
const showError = jest.fn();
const created = jest.fn();

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

function setup() {
    return renderHook(() => useGuestBooking({
        bizId: 'biz', branchId: 'branch', staffId: 'any',
        services: [{ id: 'service', branch_id: 'branch', name_ru: 'Test', duration_min: 60, price_from: 100, price_to: 300 }],
        t: (key, fallback) => fallback ?? key, feedback: { showError }, onBookingCreated: created,
    }));
}

it('tracks a created guest booking in the same anonymous session without personal contacts', async () => {
    jest.mocked(createGuestBookingRequest).mockResolvedValue({ bookingId: 'created-id', confirmed: true });
    const { result } = setup();
    act(() => { result.current.openModal(new Date('2026-10-12T03:00:00Z'), 'actual-staff'); result.current.setForm({ client_name: 'LIVE TEST Guest', client_phone: '+996500574029', client_email: '' }); });
    await act(async () => { await result.current.createGuestBooking(); });
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledWith({ event_type: 'booking_success', source: 'public', biz_id: 'biz', branch_id: 'branch', service_id: 'service', service_ids: ['service'], services_count: 1, staff_id: 'actual-staff', slot_start_at: '2026-10-12T09:00:00+06:00', booking_id: 'created-id', session_id: 'anonymous-session' });
    expect(JSON.stringify(jest.mocked(trackFunnelEvent).mock.calls)).not.toMatch(/LIVE TEST Guest|500574029/);
    expect(getSessionId).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledTimes(1);
});

it('does not report success for a locally invalid guest request', async () => {
    const { result } = setup();
    act(() => { result.current.openModal(new Date('2026-10-12T03:00:00Z'), 'actual-staff'); });
    await act(async () => { await result.current.createGuestBooking(); });
    expect(createGuestBookingRequest).not.toHaveBeenCalled();
    expect(trackFunnelEvent).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
});
