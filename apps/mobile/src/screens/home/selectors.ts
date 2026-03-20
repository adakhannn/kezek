import { isClientActiveBookingStatus } from '@core-domain/booking';

import type { Business, HomeBooking, RecentPlace } from './types';

export function getUpcomingBookings(bookings: HomeBooking[] | undefined, now: Date) {
    if (!bookings || bookings.length === 0) return [] as HomeBooking[];

    const nowTime = now.getTime();

    return bookings
        .filter((booking) => {
            if (!isClientActiveBookingStatus(booking.status as 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show')) {
                return false;
            }

            const start = new Date(booking.start_at).getTime();
            return Number.isFinite(start) && start >= nowTime;
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
        .slice(0, 3);
}

export function getRecentPlaces(bookings: HomeBooking[] | undefined) {
    if (!bookings || bookings.length === 0) return [] as RecentPlace[];

    const seen = new Set<string>();
    const places: RecentPlace[] = [];

    [...bookings]
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
        .forEach((booking) => {
            const slug = booking.business?.slug;
            const name = booking.business?.name;
            if (!slug || !name) return;
            if (seen.has(slug)) return;

            seen.add(slug);
            places.push({ slug, name });
        });

    return places.slice(0, 3);
}

export function getAvailableCategories(businesses: Business[] | undefined) {
    if (!businesses) return [] as string[];

    const categories = new Set<string>();
    businesses.forEach((business) => {
        business.categories?.forEach((category) => categories.add(category));
    });

    return Array.from(categories).sort();
}
