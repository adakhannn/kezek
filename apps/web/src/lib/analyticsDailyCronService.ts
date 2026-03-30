import { logDebug, logError } from '@/lib/log';
import { addDaysToDateString, dateRangeInclusive, fromZonedTime, todayDateString } from '@/lib/time';

type DailyCounters = {
    home_views: number;
    business_page_views: number;
    booking_flow_starts: number;
    bookings_created: number;
    bookings_confirmed_or_paid: number;
    promo_bookings: number;
    promo_revenue: number;
    total_revenue: number;
};

type SupabaseLike = {
    from: (table: string) => any;
};

type RunAnalyticsDailyCronInput = {
    supabase: SupabaseLike;
    tz: string;
    startDate?: string | null;
    endDate?: string | null;
    today?: string;
};

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function ensureCounters(map: Map<string, DailyCounters>, bizId: string) {
    let entry = map.get(bizId);
    if (!entry) {
        entry = {
            home_views: 0,
            business_page_views: 0,
            booking_flow_starts: 0,
            bookings_created: 0,
            bookings_confirmed_or_paid: 0,
            promo_bookings: 0,
            promo_revenue: 0,
            total_revenue: 0,
        };
        map.set(bizId, entry);
    }
    return entry;
}

async function recalcForDate(supabase: SupabaseLike, dateStr: string, tz: string) {
    const dayStartIso = fromZonedTime(`${dateStr}T00:00:00`, tz).toISOString();
    const dayEndIso = fromZonedTime(`${dateStr}T23:59:59.999`, tz).toISOString();
    const byBiz = new Map<string, DailyCounters>();

    const { data: eventsRaw, error: eventsError } = await supabase
        .from('analytics_events')
        .select('biz_id,event_type,metadata')
        .gte('created_at', dayStartIso)
        .lte('created_at', dayEndIso);

    if (eventsError) {
        logError('AnalyticsDailyCron', 'Failed to load analytics_events', { date: dateStr, error: eventsError.message });
        throw eventsError;
    }

    const events = (eventsRaw ?? []) as Array<{ biz_id: string | null; event_type: string }>;
    events.forEach((event) => {
        if (!event.biz_id) {
            return;
        }

        const counters = ensureCounters(byBiz, event.biz_id);
        switch (event.event_type) {
            case 'home_view':
                counters.home_views += 1;
                break;
            case 'business_page_view':
                counters.business_page_views += 1;
                break;
            case 'booking_flow_start':
                counters.booking_flow_starts += 1;
                break;
            case 'booking_created':
                counters.bookings_created += 1;
                break;
            case 'booking_confirmed_or_paid':
                counters.bookings_confirmed_or_paid += 1;
                break;
            default:
                break;
        }
    });

    const { data: bookingsRaw, error: bookingsError } = await supabase
        .from('bookings')
        .select('id,biz_id,status,promotion_applied,service_id')
        .gte('start_at', dayStartIso)
        .lte('start_at', dayEndIso);

    if (bookingsError) {
        logError('AnalyticsDailyCron', 'Failed to load bookings', { date: dateStr, error: bookingsError.message });
        throw bookingsError;
    }

    const bookings = (bookingsRaw ?? []) as Array<{
        biz_id: string | null;
        status: string;
        promotion_applied: unknown;
        service_id: string | null;
    }>;
    const successful = bookings.filter((booking) => booking.status === 'confirmed' || booking.status === 'paid');

    if (successful.length > 0) {
        const serviceIds = Array.from(new Set(successful.map((booking) => booking.service_id).filter((id): id is string => !!id)));
        const pricesByService = new Map<string, { price_from: number | null; price_to: number | null }>();

        if (serviceIds.length > 0) {
            const { data: servicesRaw, error: servicesError } = await supabase
                .from('services')
                .select('id,price_from,price_to')
                .in('id', serviceIds);

            if (!servicesError && servicesRaw) {
                const services = servicesRaw as Array<{ id: string; price_from: number | null; price_to: number | null }>;
                services.forEach((service) => {
                    pricesByService.set(service.id, {
                        price_from: service.price_from ?? null,
                        price_to: service.price_to ?? null,
                    });
                });
            } else if (servicesError) {
                logError('AnalyticsDailyCron', 'Failed to load services for revenue estimation', {
                    date: dateStr,
                    error: servicesError.message,
                });
            }
        }

        const getBasePrice = (serviceId: string | null | undefined) => {
            if (!serviceId) {
                return 0;
            }
            const pricing = pricesByService.get(String(serviceId));
            if (!pricing) {
                return 0;
            }
            const from = typeof pricing.price_from === 'number' ? pricing.price_from : null;
            const to = typeof pricing.price_to === 'number' ? pricing.price_to : null;
            if (from !== null && to !== null) {
                return (from + to) / 2;
            }
            if (from !== null) {
                return from;
            }
            if (to !== null) {
                return to;
            }
            return 0;
        };

        successful.forEach((booking) => {
            if (!booking.biz_id) {
                return;
            }
            const counters = ensureCounters(byBiz, String(booking.biz_id));
            const promo = (booking.promotion_applied ?? null) as {
                promotion_type?: string;
                final_amount?: number | string | null;
            } | null;

            if (promo && promo.promotion_type) {
                const finalAmount = typeof promo.final_amount === 'number' ? promo.final_amount : Number(promo.final_amount ?? 0);
                counters.promo_bookings += 1;
                counters.promo_revenue += finalAmount;
                counters.total_revenue += finalAmount;
            } else {
                counters.total_revenue += getBasePrice(booking.service_id);
            }
        });
    }

    if (byBiz.size === 0) {
        return { date: dateStr, updated: 0 };
    }

    const rows = Array.from(byBiz.entries()).map(([bizId, counters]) => ({
        biz_id: bizId,
        date: dateStr,
        home_views: counters.home_views,
        business_page_views: counters.business_page_views,
        booking_flow_starts: counters.booking_flow_starts,
        bookings_created: counters.bookings_created,
        bookings_confirmed_or_paid: counters.bookings_confirmed_or_paid,
        promo_bookings: counters.promo_bookings,
        promo_revenue: counters.promo_revenue,
        total_revenue: counters.total_revenue,
        updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase.from('business_daily_stats').upsert(rows, { onConflict: 'biz_id,date' });
    if (upsertError) {
        logError('AnalyticsDailyCron', 'Failed to upsert business_daily_stats', { date: dateStr, error: upsertError.message });
        throw upsertError;
    }

    return { date: dateStr, updated: rows.length };
}

export async function runAnalyticsDailyCron({
    supabase,
    tz,
    startDate,
    endDate,
    today = todayDateString(tz),
}: RunAnalyticsDailyCronInput) {
    const days =
        startDate && endDate && YMD_REGEX.test(startDate) && YMD_REGEX.test(endDate) && startDate <= endDate
            ? dateRangeInclusive(startDate, endDate, tz)
            : [addDaysToDateString(today, -1, tz)];

    const results: Array<{ date: string; updated: number }> = [];
    for (const day of days) {
        results.push(await recalcForDate(supabase, day, tz));
    }

    logDebug('AnalyticsDailyCron', 'Completed daily analytics aggregation', {
        days: results.length,
        range: days,
    });

    return {
        ok: true as const,
        data: {
            message: 'Analytics daily aggregation completed',
            results,
        },
    };
}
