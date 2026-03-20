// apps/web/src/app/cabinet/bookings/page.tsx
import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';

import ClientCabinet from '../ClientCabinet';

import BookingsPageClient from './BookingsPageClient';

import { getBusinessTimezone } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BookingsPage() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value,
            },
        }
    );

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        return <BookingsPageClient />;
    }

    // Берём только свои брони (client_id = текущий пользователь)
    // Исключаем отменённые из предстоящих
    // Предстоящие брони - записи, которые еще не закончились (end_at >= now)
    const { data: upcoming } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at, promotion_applied,
      service_id, staff_id, branch_id, biz_id,
      services:services!bookings_service_id_fkey ( id, name_ru, name_ky, name_en, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug, tz ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });

    // Прошедшие брони - записи, которые уже закончились (end_at < now)
    const { data: past } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at, promotion_applied,
      service_id, staff_id, branch_id, biz_id,
      services:services!bookings_service_id_fkey ( id, name_ru, name_ky, name_en, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug, tz ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .order('start_at', { ascending: false });

    const now = new Date();
    const allBookings = [...(upcoming ?? []), ...(past ?? [])] as Array<{
        id: string;
        end_at: string;
        businesses?: { tz?: string | null }[] | { tz?: string | null } | null;
    }>;

    const getBusinessTz = (booking: { businesses?: { tz?: string | null }[] | { tz?: string | null } | null }) => {
        const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
        return getBusinessTimezone(business?.tz ?? null);
    };

    const isUpcomingBooking = (booking: { end_at: string; businesses?: { tz?: string | null }[] | { tz?: string | null } | null }) => {
        const timezone = getBusinessTz(booking);
        const nowLabel = formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
        const endLabel = formatInTimeZone(new Date(booking.end_at), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
        return endLabel >= nowLabel;
    };

    const upcomingFiltered = allBookings
        .filter(isUpcomingBooking)
        .sort((a, b) => new Date(a.end_at).getTime() - new Date(b.end_at).getTime());

    const pastFiltered = allBookings
        .filter((booking) => !isUpcomingBooking(booking))
        .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime());

    return (
        <ClientCabinet
            userId={userId}
            upcoming={upcomingFiltered}
            past={pastFiltered}
        />
    );
}

