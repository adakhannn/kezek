export type Branch = { id: string; name: string; is_active: boolean };

export type StaffData = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

export type Review = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    booking_id: string;
    service_name: string | null;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
};

export type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};
