// apps/web/src/app/cabinet/bookings/page.tsx
import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';

import ClientCabinet from '../ClientCabinet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function BookingsPage() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
            },
        }
    );

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Войдите, чтобы посмотреть записи</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Авторизуйтесь, чтобы увидеть свои бронирования</p>
                <a
                    href="/auth/sign-in"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                >
                    Войти
                </a>
            </div>
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
      service_id, staff_id, branch_id, biz_id,
      services:services!bookings_service_id_fkey ( id, name_ru, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug ),
      reviews:reviews ( id, rating, comment )
    `)
        .eq('client_id', userId)
        .neq('status', 'cancelled')
        .gte('start_at', nowISO)
        .order('start_at', { ascending: true });

    const { data: past } = await supabase
        .from('bookings')
        .select(`
      id, status, start_at, end_at,
      service_id, staff_id, branch_id, biz_id,
      services:services!bookings_service_id_fkey ( id, name_ru, duration_min ),
      staff:staff!bookings_staff_id_fkey ( id, full_name ),
      branches:branches!bookings_branch_id_fkey ( id, name, lat, lon, address ),
      businesses:businesses!bookings_biz_id_fkey ( id, name, slug ),
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

