export type Booking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
    } | null;
    staff: {
        full_name: string;
    } | null;
    branch: {
        name: string;
        address: string;
    } | null;
    business: {
        name: string;
    } | null;
};

export type CabinetTab = 'upcoming' | 'history';
