import { bookingCommandError, BookingSlotConflictError } from '@/lib/bookingSlotConflict';
test.each([
    { message: 'time slot is already booked', code: 'P0001' },
    { message: 'exclusion constraint rejects overlapping range', code: '23P01' },
])('recognizes the booking writer conflict: %s', error => {
    expect(bookingCommandError(error)).toBeInstanceOf(BookingSlotConflictError);
});
test('does not misclassify unrelated database failures', () => {
    const result = bookingCommandError({ message: 'permission denied', code: '42501' });
    expect(result).not.toBeInstanceOf(BookingSlotConflictError);
    expect(result.message).toBe('permission denied');
});
