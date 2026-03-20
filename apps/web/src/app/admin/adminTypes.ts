export type BizRow = {
    id: string;
    name: string;
    slug: string;
    created_at: string;
};

export type BookingRel = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string } | { name_ru: string }[] | null;
    staff: { full_name: string } | { full_name: string }[] | null;
    businesses: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    branches: { name: string } | { name: string }[] | null;
};

export type TodayBookingRow = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client: string;
    service: string;
    staff: string;
    biz: string;
    bizId: string | null;
    branch: string;
};

export type SystemCheck = {
    ok: boolean;
    label: string;
};
