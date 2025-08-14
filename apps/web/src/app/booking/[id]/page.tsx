import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
import {formatInTimeZone} from 'date-fns-tz';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

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
            get: (n) => cookieStore.get(n)?.value,
            // no-op’ы нужны, чтобы supabase/ssr не падал в RSC
            set: () => {
            },
            remove: () => {
            },
        },
    });

    // Пытаемся читать по RLS (клиент своей брони, сотрудник бизнеса, или супер-админ)
    const {data, error} = await supabase
        .from('bookings')
        .select(`
      id,status,start_at,end_at,
      services:services!bookings_service_id_fkey(name_ru),
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
        <main className="mx-auto max-w-xl p-6 space-y-3">
            <h1 className="text-2xl font-semibold">Бронь #{String(data.id).slice(0, 8)}</h1>
            <div className="border rounded p-3">
                <div>Услуга: <b>{service?.name_ru ?? '—'}</b></div>
                <div>Мастер: <b>{master?.full_name ?? '—'}</b></div>
                <div>Начало: <b>{formatInTimeZone(new Date(data.start_at), TZ, 'dd.MM.yyyy HH:mm')}</b></div>
                <div>Статус: <b>{data.status}</b></div>
            </div>
            <a href="/" className="underline">На главную</a>
        </main>
    );
}

async function FallbackBooking({ id }: { id: string }) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data, error } = await supabase.rpc('booking_view_public', { p_id: id });
    if (error || !data || data.length === 0) {
        return (
            <main className="mx-auto max-w-xl p-6">
                <div className="text-red-500">Бронь не найдена</div>
                <div className="text-sm text-gray-500">ID: {id}</div>
                <a href="/" className="underline">На главную</a>
            </main>
        );
    }

    const row = data[0];
    return (
        <main className="mx-auto max-w-xl p-6 space-y-3">
            <h1 className="text-2xl font-semibold">Бронь #{String(row.id).slice(0,8)}</h1>
            <div className="border rounded p-3">
                <div>Услуга: <b>{row.service_name}</b></div>
                <div>Мастер: <b>{row.staff_name}</b></div>
                <div>Начало: <b>{formatInTimeZone(new Date(row.start_at), TZ, 'dd.MM.yyyy HH:mm')}</b></div>
                <div>Статус: <b>{row.status}</b></div>
            </div>
            <a href="/" className="underline">На главную</a>
        </main>
    );
}

