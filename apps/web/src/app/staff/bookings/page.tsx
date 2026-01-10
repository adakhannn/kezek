// apps/web/src/app/staff/bookings/page.tsx
import { formatInTimeZone } from 'date-fns-tz';

import StaffBookingsView from './StaffBookingsView';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function StaffBookingsPage() {
    const { supabase, staffId } = await getStaffContext();

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Параллельные запросы для предстоящих и прошедших броней
    const [upcomingResult, pastResult] = await Promise.all([
        // Предстоящие брони (исключаем отменённые) - записи, которые еще не закончились (end_at >= now)
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, name_ky, name_en, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gte('end_at', nowISO)
            .order('start_at', { ascending: true }),
        // Прошедшие брони - записи, которые уже закончились (end_at < now)
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, name_ky, name_en, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .lt('end_at', nowISO)
            .order('start_at', { ascending: false }),
    ]);

    const upcoming = upcomingResult.data ?? [];
    const past = pastResult.data ?? [];

    return (
        <StaffBookingsView
            upcoming={upcoming}
            past={past}
        />
    );
}

