// apps/web/src/app/cabinet/bookings/page.tsx
import { formatInTimeZone } from 'date-fns-tz';
import type { ComponentProps } from 'react';

import ClientCabinet from '../ClientCabinet';

import BookingsPageClient from './BookingsPageClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BookingsPage() {
    const supabase = await createSupabaseServerClient();

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        return <BookingsPageClient />;
    }

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Берём только свои брони (client_id = текущий пользователь)
    // Исключаем отменённые из предстоящих
    // Предстоящие брони - записи, которые еще не закончились (end_at >= now)
    const { data: upcoming, error: upcomingError } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at, promotion_applied, subscription_applied,
      service_id, staff_id, branch_id, biz_id,
      booking_services (duration_min, service:services (id, name_ru, name_ky, name_en, duration_min)),
      services:services!bookings_service_id_fkey ( id, name_ru, name_ky, name_en, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .in('status', ['hold', 'confirmed'])
        .gte('end_at', nowISO)
        .order('start_at', { ascending: true });

    // Terminal visits belong in own history even before their scheduled end.
    const { data: past, error: pastError } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at, promotion_applied, subscription_applied,
      service_id, staff_id, branch_id, biz_id,
      booking_services (duration_min, service:services (id, name_ru, name_ky, name_en, duration_min)),
      services:services!bookings_service_id_fkey ( id, name_ru, name_ky, name_en, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .or(`end_at.lt.${nowISO},status.in.(paid,cancelled,no_show)`)
        .order('start_at', { ascending: false });

    // FE-08: "no upcoming bookings" after a failed read would invite a duplicate booking.
    if (upcomingError || pastError) {
        logError('CabinetBookingsPage', 'Failed to load own bookings', { upcomingError, pastError });
        return <LoadFailedNotice page />;
    }

    // jsonb columns (promotion_applied, subscription_applied) are written by booking commands.
    return (
        <ClientCabinet
            userId={userId}
            upcoming={(upcoming ?? []) as unknown as ComponentProps<typeof ClientCabinet>['upcoming']}
            past={(past ?? []) as unknown as ComponentProps<typeof ClientCabinet>['past']}
        />
    );
}

