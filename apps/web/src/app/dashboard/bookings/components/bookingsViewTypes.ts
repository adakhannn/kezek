export type ServiceRow = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    branch_id: string;
};

export type StaffRow = {
    id: string;
    full_name: string;
    branch_id: string;
};

export type BranchRow = {
    id: string;
    name: string;
};

export type BookingItem = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    start_at: string;
    end_at: string;
    services?: { name_ru: string; name_ky?: string | null; name_en?: string | null }[];
    staff?: { full_name: string }[];
    servicesSummary?: string;
    client_name?: string | null;
    client_phone?: string | null;
};

export type TabKey = 'calendar' | 'list' | 'desk';
