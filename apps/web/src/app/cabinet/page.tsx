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
            <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-2xl mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Личный кабинет</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Войдите, чтобы посмотреть свои записи</p>
                    <a
                        href="/auth/sign-in"
                        className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        Войти
                    </a>
                </div>
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
