/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useBookingCreation } from '@/app/b/[slug]/hooks/useBookingCreation';
import { createQuickHoldBooking, QuickHoldClientError } from '@/lib/quickHoldClient';

jest.mock('@/lib/quickHoldClient', () => ({ ...jest.requireActual('@/lib/quickHoldClient'), createQuickHoldBooking: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ trackFunnelEvent: jest.fn(), getSessionId: jest.fn() }));

const slot = new Date('2026-10-19T03:00:00Z');
function setup(isAuthed = true, selection: { staffId?: string; branchId?: string; noServices?: boolean; complex?: boolean } = {}) {
    const selectionChanged = jest.fn();
    const onAuthChoiceRequest = jest.fn();
    const onBookingCreated = jest.fn();
    const showError = jest.fn();
    const services = [{ id: 'service', branch_id: 'branch', name_ru: 'Test', duration_min: 60, price_from: 100, price_to: 300 }];
    if (selection.complex) services.push({ ...services[0], id: 'second', duration_min: 15 });
    const params = {
        bizId: 'biz', branchId: selection.branchId ?? 'branch', staffId: selection.staffId ?? 'any', isAuthed,
        services: selection.noServices ? [] : services,
        t: (key: string, fallback?: string) => fallback ?? key,
        feedback: { showError }, onAuthChoiceRequest, onBookingCreated,
        // Legacy callback models the URL-changing selection side effect from WB151.
        onStaffIdChange: selectionChanged,
    };
    return { ...renderHook(() => useBookingCreation(params)), selectionChanged, onAuthChoiceRequest, onBookingCreated, showError };
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('resolves the command staff without changing any-master selection during creation', async () => {
    let complete!: (value: { bookingId: string }) => void;
    jest.mocked(createQuickHoldBooking).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const hook = setup();
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.createBooking(slot, 'resolved-staff'); });
    expect(hook.result.current.loading).toBe(true);
    expect(hook.selectionChanged).not.toHaveBeenCalled();
    expect(createQuickHoldBooking).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'resolved-staff', start_at: '2026-10-19T09:00:00+06:00' }));
    await act(async () => { complete({ bookingId: 'booking' }); await pending; });
    expect(hook.onBookingCreated).toHaveBeenCalledTimes(1);
    expect(hook.selectionChanged).not.toHaveBeenCalled();
});

test('a rejected any-master command preserves selection and reports the error', async () => {
    jest.mocked(createQuickHoldBooking).mockRejectedValue(new QuickHoldClientError('Unavailable', { code: 'booking_slot_unavailable', status: 409 }));
    const hook = setup();
    await act(async () => { await hook.result.current.createBooking(slot, 'resolved-staff'); });
    expect(hook.selectionChanged).not.toHaveBeenCalled();
    expect(hook.showError).toHaveBeenCalledTimes(1);
    expect(hook.onBookingCreated).not.toHaveBeenCalled();
});

test('guest auth choice still receives the resolved staff without issuing a command', async () => {
    const hook = setup(false);
    await act(async () => { await hook.result.current.createBooking(slot, 'resolved-staff'); });
    expect(hook.onAuthChoiceRequest).toHaveBeenCalledWith(slot, 'resolved-staff');
    expect(createQuickHoldBooking).not.toHaveBeenCalled();
});

test('missing any-master resolution never creates a booking', async () => {
    const hook = setup();
    await act(async () => { await hook.result.current.createBooking(slot); });
    expect(createQuickHoldBooking).not.toHaveBeenCalled();
    expect(hook.showError).toHaveBeenCalledTimes(1);
});

test.each([{ noServices: true }, { staffId: '' }, { branchId: '' }])('rejects incomplete selection before command: %j', async selection => {
    const hook = setup(true, selection);
    await act(async () => { await hook.result.current.createBooking(slot, 'resolved-staff'); });
    expect(createQuickHoldBooking).not.toHaveBeenCalled();
    expect(hook.showError).toHaveBeenCalledTimes(1);
});

test('concrete staff and multiple services retain the complex command payload', async () => {
    jest.mocked(createQuickHoldBooking).mockResolvedValue({ bookingId: 'complex-booking' });
    const hook = setup(true, { staffId: 'concrete-staff', complex: true });
    await act(async () => { await hook.result.current.createBooking(slot); });
    expect(createQuickHoldBooking).toHaveBeenCalledWith(expect.objectContaining({ staff_id: 'concrete-staff', services: [
        { service_id: 'service', duration_min: 60, order_index: 0 },
        { service_id: 'second', duration_min: 15, order_index: 1 },
    ] }));
    expect(hook.onBookingCreated).toHaveBeenCalledTimes(1);
});

test('double confirmation cannot issue a second in-flight command', async () => {
    let complete!: (value: { bookingId: string }) => void;
    jest.mocked(createQuickHoldBooking).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const hook = setup();
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.createBooking(slot, 'resolved-staff'); });
    await act(async () => { await hook.result.current.createBooking(slot, 'resolved-staff'); });
    expect(createQuickHoldBooking).toHaveBeenCalledTimes(1);
    await act(async () => { complete({ bookingId: 'one' }); await pending; });
});
