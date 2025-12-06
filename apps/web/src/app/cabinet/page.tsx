// apps/web/src/app/cabinet/page.tsx
import { formatInTimeZone } from 'date-fns-tz';

import ClientCabinet from './ClientCabinet';

import { getSupabaseServer } from '@/lib/authBiz';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function Page() {
    const supabase = await getSupabaseServer();

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        return (
            <main className="p-6">
                <div className="text-gray-600">Войдите, чтобы посмотреть свои записи.</div>
            </main>
        );
    }

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Общий select для броней
    const bookingsSelect = `
      id, status, start_at, end_at,
      services:services!bookings_service_id_fkey ( name_ru, duration_min ),
      staff:staff!bookings_staff_id_fkey ( full_name ),
      branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( name, slug ),
      reviews:reviews ( id, rating, comment )
    `;

    // Параллельные запросы для предстоящих и прошедших броней
    const [upcomingResult, pastResult] = await Promise.all([
        // Предстоящие брони (исключаем отменённые)
        supabase
            .from('bookings')
            .select(bookingsSelect)
            .eq('client_id', userId)
            .neq('status', 'cancelled')
            .gte('start_at', nowISO)
            .order('start_at', { ascending: true }),
        // Прошедшие брони
        supabase
            .from('bookings')
            .select(bookingsSelect)
            .eq('client_id', userId)
            .lt('start_at', nowISO)
            .order('start_at', { ascending: false }),
    ]);

    const upcoming = upcomingResult.data ?? [];
    const past = pastResult.data ?? [];

    return (
        <ClientCabinet
            userId={userId}
            upcoming={upcoming ?? []}
            past={past ?? []}
        />
    );
}
