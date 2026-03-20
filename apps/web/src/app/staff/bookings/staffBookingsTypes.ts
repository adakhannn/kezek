export type Booking = {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    services:
        | { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }
        | null
        | { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    branches:
        | { name: string; lat: number | null; lon: number | null; address: string | null }
        | null
        | { name: string; lat: number | null; lon: number | null; address: string | null }[];
    businesses:
        | { id?: string; name: string; slug: string | null }
        | null
        | { id?: string; name: string; slug: string | null }[];
};

export type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    active: boolean;
    branch_id: string;
};

export type Staff = {
    id: string;
    full_name: string;
    is_active: boolean;
    branch_id: string;
};

export type Branch = {
    id: string;
    name: string;
    is_active: boolean;
};

export type TranslationFn = (key: string, fallback: string) => string;
