/** One active staff card: a person has one per business they work in (ARCH-02). */
export type StaffInfo = {
    id: string;
    full_name: string;
    biz_id: string;
    created_at: string | null;
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

export type UpcomingBooking = {
    id: string;
    start_at: string;
    end_at: string;
    service: {
        name_ru: string | null;
    } | null;
    client_name: string | null;
    client_phone: string | null;
};

export type BookingRow = {
    id: string;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    service: { name_ru: string | null }[] | { name_ru: string | null } | null;
};
