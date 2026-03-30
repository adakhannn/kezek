export type StaffInfo = {
    id: string;
    full_name: string;
    branch: {
        id: string;
        name: string;
    } | null;
    business: {
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
