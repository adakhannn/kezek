import { getCached, setCached } from '@/lib/simpleCache';

type LoadAdminLike = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => any;
        };
    };
};

type LoadRow = {
    date: string;
    hour: number;
    bookings_count: number | null;
    promo_bookings_count: number | null;
    staff_count: number | null;
    unique_clients_count: number | null;
};

export async function getDashboardAnalyticsLoad({
    admin,
    bizId,
    branchId,
    startDate,
    endDate,
}: {
    admin: LoadAdminLike;
    bizId: string;
    branchId?: string;
    startDate: string;
    endDate: string;
}): Promise<
    | { ok: true; data: unknown }
    | { ok: false; error: 'server'; message: string; status: 500 }
> {
    const cacheKey = `dashboard_analytics_load:${bizId}:${branchId || 'all'}:${startDate}:${endDate}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
        return { ok: true, data: cached };
    }

    let query = admin
        .from('business_hourly_load')
        .select('biz_id,branch_id,date,hour,bookings_count,promo_bookings_count,staff_count,unique_clients_count')
        .eq('biz_id', bizId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('hour', { ascending: true });

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) {
        return {
            ok: false,
            error: 'server',
            message: 'Failed to load hourly analytics',
            status: 500,
        };
    }

    const payload = {
        bizId,
        branchId: branchId ?? null,
        period: { startDate, endDate },
        points: ((data ?? []) as LoadRow[]).map((row) => ({
            date: row.date,
            hour: row.hour,
            bookingsCount: row.bookings_count ?? 0,
            promoBookingsCount: row.promo_bookings_count ?? 0,
            staffCount: row.staff_count ?? null,
            uniqueClientsCount: row.unique_clients_count ?? null,
        })),
    };

    setCached(cacheKey, payload, 60_000);

    return {
        ok: true,
        data: payload,
    };
}
