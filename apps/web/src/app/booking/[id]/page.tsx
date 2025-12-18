import {createServerClient} from '@supabase/ssr';
import {formatInTimeZone} from 'date-fns-tz';
import {cookies} from 'next/headers';
import Link from "next/link";

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
    const {data} = await supabase
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
        <BookingLayout
            id={String(data.id)}
            serviceName={service?.name_ru ?? '—'}
            masterName={master?.full_name ?? '—'}
            startAt={new Date(data.start_at)}
            status={data.status}
        />
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
                <Link href="/" className="underline">На главную</Link>
            </main>
        );
    }

    const row = data[0];
    return (
        <BookingLayout
            id={String(row.id)}
            serviceName={row.service_name}
            masterName={row.staff_name}
            startAt={new Date(row.start_at)}
            status={row.status}
        />
    );
}

type BookingLayoutProps = {
    id: string;
    serviceName: string;
    masterName: string;
    startAt: Date;
    status: string;
};

function statusLabel(status: string): { text: string; className: string } {
    switch (status) {
        case 'confirmed':
            return { text: 'Подтверждена', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
        case 'paid':
            return { text: 'Оплачена', className: 'bg-emerald-600 text-white dark:bg-emerald-500' };
        case 'hold':
            return { text: 'Ожидает подтверждения', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
        case 'cancelled':
            return { text: 'Отменена', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        default:
            return { text: status, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' };
    }
}

function BookingLayout({ id, serviceName, masterName, startAt, status }: BookingLayoutProps) {
    const s = statusLabel(status);

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-xl space-y-6 py-10">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
                        Бронь #{id.slice(0, 8)}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Подтверждение записи и основные детали визита
                    </p>
                </div>

                <section className="rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-md backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Статус
                            </div>
                            <div className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm border border-transparent">
                                <span className={s.className + ' rounded-full px-2 py-0.5'}>{s.text}</span>
                            </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                            ID: <span className="font-mono">{id}</span>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                    <dl className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">Услуга</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {serviceName}
                            </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">Мастер</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {masterName}
                            </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">Дата и время</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {formatInTimeZone(startAt, TZ, 'dd.MM.yyyy HH:mm')}
                            </dd>
                        </div>
                    </dl>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Если вам нужно изменить или отменить запись, свяжитесь с салоном по телефону или через тот
                        канал связи, который указан на странице бизнеса.
                    </p>
                </section>

                <div className="flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                        На главную
                    </Link>
                </div>
            </div>
        </main>
    );
}

