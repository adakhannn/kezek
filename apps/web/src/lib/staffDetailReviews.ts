type ReviewRelation = { id:string; rating:number; comment:string | null; created_at:string };
type ServiceRelation = { name_ru:string; name_ky?:string | null; name_en?:string | null };

export type StaffReviewBooking = {
    id:string;
    start_at:string;
    end_at:string;
    client_name:string | null;
    client_phone:string | null;
    services?:ServiceRelation | ServiceRelation[] | null;
    reviews?:ReviewRelation | ReviewRelation[] | null;
};

/** Adapt PostgREST to-one/to-many joins without changing query authorization. */
export function projectStaffDetailReviews(bookings: readonly StaffReviewBooking[]) {
    return bookings.flatMap((booking) => {
        const reviews = Array.isArray(booking.reviews) ? booking.reviews : booking.reviews ? [booking.reviews] : [];
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
        // Preserve the existing service-name preference; locale presentation is separate.
        const serviceName = service ? service.name_ky || service.name_en || service.name_ru : null;
        return reviews.map((review) => ({
            ...review,
            booking_id:booking.id,
            service_name:serviceName,
            start_at:booking.start_at,
            end_at:booking.end_at,
            client_name:booking.client_name,
            client_phone:booking.client_phone,
        }));
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
