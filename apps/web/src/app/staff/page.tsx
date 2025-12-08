// apps/web/src/app/staff/page.tsx
import { formatInTimeZone } from 'date-fns-tz';

import StaffCabinet from './StaffCabinet';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function Page() {
    const { supabase, userId, staffId } = await getStaffContext();

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Общий select для броней
    const bookingsSelect = `
      id, status, start_at, end_at, client_name, client_phone,
      services:services!bookings_service_id_fkey ( name_ru, duration_min ),
      branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( name, slug )
    `;

    // Параллельные запросы для предстоящих и прошедших броней
    const [upcomingResult, pastResult] = await Promise.all([
        // Предстоящие брони (исключаем отменённые)
        supabase
            .from('bookings')
            .select(bookingsSelect)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gte('start_at', nowISO)
            .order('start_at', { ascending: true }),
        // Прошедшие брони
        supabase
            .from('bookings')
            .select(bookingsSelect)
            .eq('staff_id', staffId)
            .lt('start_at', nowISO)
            .order('start_at', { ascending: false }),
    ]);

    const upcoming = upcomingResult.data ?? [];
    const past = pastResult.data ?? [];

    return (
        <StaffCabinet
            userId={userId}
            staffId={staffId}
            upcoming={upcoming}
            past={past}
        />
    );
}

