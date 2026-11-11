import { bookingCancellationError } from '@/lib/bookingCancellationError';

test.each([
    ['BOOKING_NOT_FOUND', 404, 'not_found'],
    ['BOOKING_FORBIDDEN', 403, 'forbidden'],
    ['BOOKING_FINANCIAL_REVERSAL_REQUIRED', 409, 'financial_reversal_required'],
    ['BOOKING_STATUS_NOT_CANCELLABLE', 409, 'not_cancellable'],
    ['BOOKING_CHANGED', 409, 'booking_changed'],
])('maps stable cancellation error %s without discarding its meaning', (message, status, error) => {
    expect(bookingCancellationError({ message })).toMatchObject({ ok: false, status, error });
});

test('financial conflict tells the user to arrange reversal and never exposes arbitrary DB text', () => {
    expect(bookingCancellationError(new Error('BOOKING_FINANCIAL_REVERSAL_REQUIRED'))?.message).toContain('финансового возврата');
    expect(bookingCancellationError({ message: 'unrecognized database detail' })).toBeNull();
});
