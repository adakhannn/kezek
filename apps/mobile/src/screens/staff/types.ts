/** One active staff card: a person has one per business they work in (ARCH-02). */
export type StaffInfo = {
    id: string;
    full_name: string;
    biz_id: string;
    created_at: string | null;
    /** The master's photo (public URL), set from the staff cabinet; null shows initials. */
    avatar_url?: string | null;
    branch: {
        id: string;
        name: string;
    } | null;
    business: {
        /** businesses.tz: booking times are shown in the business's zone (ARCH-11). */
        tz?: string | null;
        id: string;
        name: string;
    } | null;
};

/** S1: the two lists of the staff workspace, like the website's /staff/bookings. */
export type StaffBookingsTab = 'upcoming' | 'past';

type ServiceNames = { name_ru: string | null; name_ky?: string | null; name_en?: string | null };

export type UpcomingBooking = {
    id: string;
    status: string | null;
    start_at: string;
    end_at: string;
    service: ServiceNames | null;
    client_name: string | null;
    client_phone: string | null;
};

export type BookingRow = {
    id: string;
    status?: string | null;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    service: ServiceNames[] | ServiceNames | null;
};
