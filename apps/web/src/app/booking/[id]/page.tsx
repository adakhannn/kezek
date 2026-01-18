import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

import BookingLayoutClient from './BookingLayoutClient';
import NotFoundMessage from './NotFoundMessage';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';


export default async function BookingPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const {id} = await params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            // no-op’ы нужны, чтобы supabase/ssr не падал в RSC
            set: () => {
            },
            remove: () => {
            },
        },
    });

    // Пытаемся читать по RLS (клиент своей брони, сотрудник бизнеса, или супер-админ)
    const {data} = await supabase
        .from('bookings')
        .select(`
      id,status,start_at,end_at,promotion_applied,
      services:services!bookings_service_id_fkey(name_ru, name_ky, name_en),
      staff:staff!bookings_staff_id_fkey(full_name)
    `)
        .eq('id', id)
        .maybeSingle();

    // Если RLS не пустил (data=null) — ниже есть fallback через RPC (Шаг 2)
    if (!data) {
        // рендерим пусто — компонент заново отрисуется после RPC (см. Шаг 2 код ниже)
        // но чтобы сейчас всё работало, просто вернём упрощённый Fallback (после Шага 2 заменим)
        return <FallbackBooking id={id}/>;
    }

    const service = Array.isArray(data.services) ? data.services[0] : data.services;
    const master = Array.isArray(data.staff) ? data.staff[0] : data.staff;

    return (
        <LanguageProvider>
            <BookingLayoutClient
                id={String(data.id)}
                service={service ? {
                    name_ru: service.name_ru,
                    name_ky: service.name_ky ?? null,
                    name_en: service.name_en ?? null,
                } : null}
                masterName={master?.full_name ?? '—'}
                startAt={new Date(data.start_at)}
                status={data.status}
                promotionApplied={data.promotion_applied}
            />
        </LanguageProvider>
    );
}

async function FallbackBooking({ id }: { id: string }) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data, error } = await supabase.rpc('booking_view_public', { p_id: id });
    if (error || !data || data.length === 0) {
        return (
            <LanguageProvider>
                <main className="mx-auto max-w-xl p-6">
                    <NotFoundMessage id={id} />
                </main>
            </LanguageProvider>
        );
    }

    const row = data[0];
    // Загружаем promotion_applied отдельно, так как RPC может не возвращать его
    const { data: bookingData } = await supabase
        .from('bookings')
        .select('promotion_applied')
        .eq('id', id)
        .maybeSingle();
    
    return (
        <LanguageProvider>
            <BookingLayoutClient
                id={String(row.id)}
                service={row.service_name ? {
                    name_ru: row.service_name,
                    name_ky: null,
                    name_en: null,
                } : null}
                masterName={row.staff_name}
                startAt={new Date(row.start_at)}
                status={row.status}
                promotionApplied={bookingData?.promotion_applied || null}
            />
        </LanguageProvider>
    );
}


