import { formatInTimeZone } from 'date-fns-tz';

import { fromZonedTime, getBusinessTimezone } from '@/lib/time';

type HourlyCounters = {
    bookings_count: number;
    promo_bookings_count: number;
    staffIds: Set<string>;
    clientIds: Set<string>;
};

type ServiceClientLike = {
    from: (table: string) => any;
};

export async function recalcHourlyForDate({
    supabase,
    dateStr,
}: {
    supabase: ServiceClientLike;
    dateStr: string;
}): Promise<{ date: string; updated: number }> {
    const dayStartIso = fromZonedTime(`${dateStr}T00:00:00`, 'UTC').toISOString();
    const dayEndIso = fromZonedTime(`${dateStr}T23:59:59.999`, 'UTC').toISOString();

    const byKey = new Map<string, HourlyCounters>();
    const bizTzMap = new Map<string, string | null>();

    const ensure = (bizId: string, branchId: string, hour: number): HourlyCounters => {
        const key = `${bizId}::${branchId}::${hour}`;
        let entry = byKey.get(key);
        if (!entry) {
            entry = {
                bookings_count: 0,
                promo_bookings_count: 0,
                staffIds: new Set<string>(),
                clientIds: new Set<string>(),
            };
            byKey.set(key, entry);
        }
        return entry;
    };

    const { data: bookingsRaw, error } = await supabase
        .from('bookings')
        .select('id,biz_id,branch_id,start_at,status,promotion_applied,client_id,staff_id')
        .gte('start_at', dayStartIso)
        .lte('start_at', dayEndIso)
        .in('status', ['confirmed', 'paid']);

    if (error) {
        throw error;
    }

    const bookings = (bookingsRaw ?? []) as Array<{
        biz_id: string | null;
        branch_id: string | null;
        start_at: string;
        promotion_applied: { promotion_type?: string } | null;
        client_id: string | null;
        staff_id: string | null;
    }>;

    if (bookings.length === 0) {
        return { date: dateStr, updated: 0 };
    }

    const bizIds = Array.from(
        new Set(
            bookings
                .map((booking) => booking.biz_id)
                .filter((id): id is string => !!id)
                .map((id) => String(id)),
        ),
    );

    if (bizIds.length > 0) {
        const { data: bizRowsRaw } = await supabase.from('businesses').select('id,tz').in('id', bizIds);
        const bizRows = (bizRowsRaw ?? []) as Array<{ id: string; tz: string | null }>;
        bizRows.forEach((biz) => {
            bizTzMap.set(String(biz.id), biz.tz ?? null);
        });
    }

    bookings.forEach((booking) => {
        const bizId = booking.biz_id ? String(booking.biz_id) : null;
        const branchId = booking.branch_id ? String(booking.branch_id) : null;
        if (!bizId || !branchId) return;

        const tz = getBusinessTimezone(bizTzMap.get(bizId) ?? undefined);
        const start = new Date(booking.start_at);
        const localDate = formatInTimeZone(start, tz, 'yyyy-MM-dd');
        if (localDate !== dateStr) {
            return;
        }

        const hour = Number.parseInt(formatInTimeZone(start, tz, 'H'), 10);
        if (Number.isNaN(hour) || hour < 0 || hour > 23) {
            return;
        }

        const counters = ensure(bizId, branchId, hour);
        counters.bookings_count += 1;

        if (booking.promotion_applied?.promotion_type) {
            counters.promo_bookings_count += 1;
        }

        if (booking.staff_id) {
            counters.staffIds.add(String(booking.staff_id));
        }
        if (booking.client_id) {
            counters.clientIds.add(String(booking.client_id));
        }
    });

    if (byKey.size === 0) {
        return { date: dateStr, updated: 0 };
    }

    const nowIso = new Date().toISOString();
    const rows = Array.from(byKey.entries()).map(([key, counters]) => {
        const [bizId, branchId, hourStr] = key.split('::');
        return {
            biz_id: bizId,
            branch_id: branchId,
            date: dateStr,
            hour: Number.parseInt(hourStr, 10),
            bookings_count: counters.bookings_count,
            promo_bookings_count: counters.promo_bookings_count,
            staff_count: counters.staffIds.size || null,
            unique_clients_count: counters.clientIds.size || null,
            updated_at: nowIso,
        };
    });

    const { error: upsertError } = await supabase
        .from('business_hourly_load')
        .upsert(rows, { onConflict: 'biz_id,branch_id,date,hour' });

    if (upsertError) {
        throw upsertError;
    }

    return { date: dateStr, updated: rows.length };
}
