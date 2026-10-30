type ServiceNames = { name_ru?: string | null; name_ky?: string | null; name_en?: string | null };
type SearchableBooking = {
    id: string;
    client_name?: string | null;
    client_phone?: string | null;
    services?: ServiceNames | ServiceNames[] | null;
    staff?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    servicesSummary?: string;
};

/** Search the loaded result page without discarding its unfiltered rows. */
export function filterDashboardBookings<T extends SearchableBooking>(bookings: T[], query: string): T[] {
    const term = query.trim().toLowerCase();
    if (!term) return bookings;

    return bookings.filter(booking => {
        const services = Array.isArray(booking.services) ? booking.services : [booking.services];
        const staff = Array.isArray(booking.staff) ? booking.staff : [booking.staff];
        const fields = [
            booking.id, booking.client_name, booking.client_phone, booking.servicesSummary,
            ...services.flatMap(service => [service?.name_ru, service?.name_ky, service?.name_en]),
            ...staff.map(member => member?.full_name),
        ];
        return fields.some(value => value?.toLowerCase().includes(term));
    });
}
