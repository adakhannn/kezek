/** Convert the booking writer's known overlap rejection at the infrastructure boundary. */
export class BookingSlotConflictError extends Error {
    constructor() {
        super('The selected time is no longer available');
        this.name = 'BookingSlotConflictError';
    }
}

export function bookingCommandError(error: { message: string; code?: string }): Error {
    if (error.code === '23P01' || error.message === 'time slot is already booked') {
        return new BookingSlotConflictError();
    }
    return new Error(error.message);
}
