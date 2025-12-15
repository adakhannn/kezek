// apps/web/src/app/cabinet/page.tsx
import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';

import ClientCabinet from './ClientCabinet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function Page() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
                // set/remove в RSC не используем
            },
        }
    );

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

    // Берём только свои брони (client_id = текущий пользователь)
    // Исключаем отменённые из предстоящих
    const { data: upcoming } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at,
      services:services!bookings_service_id_fkey ( name_ru, duration_min ),
      staff:staff!bookings_staff_id_fkey ( full_name ),
      branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( name, slug ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .neq('status', 'cancelled')
        .gte('start_at', nowISO)
        .order('start_at', { ascending: true });

    console.log(upcoming)

    const { data: past } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at,
      services:services!bookings_service_id_fkey ( name_ru, duration_min ),
      staff:staff!bookings_staff_id_fkey ( full_name ),
      branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( name, slug ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .lt('start_at', nowISO)
        .order('start_at', { ascending: false });

    return (
        <ClientCabinet
            userId={userId}
            upcoming={upcoming ?? []}
            past={past ?? []}
        />
    );
}
