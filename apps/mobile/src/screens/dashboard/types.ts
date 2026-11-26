/** A business the user owns or manages (GET /api/mobile/manager/businesses, O1/O3). */
export type Business = {
    id: string;
    name: string;
    slug: string | null;
    address: string | null;
    phones: string[] | null;
    /** businesses.tz, already checked by the server; absent in older answers. */
    tz?: string;
    role?: 'owner' | 'admin' | 'manager';
};

export type ManagerBookingsScope = 'today' | 'upcoming';

/** One booking of the business feed (GET /api/mobile/manager/bookings). */
export type ManagerBooking = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'no_show' | 'cancelled';
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    service: { name_ru: string | null; name_ky?: string | null; name_en?: string | null } | null;
    staff_name: string | null;
    branch_name: string | null;
};

export type ManagerBookingAction = 'confirm' | 'cancel' | 'attended' | 'no_show';
