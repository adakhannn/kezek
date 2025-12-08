import {formatInTimeZone} from 'date-fns-tz';
import Link from "next/link";

import { getSupabaseServer } from '@/lib/authBiz';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function BookingPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const {id} = await params;
    const supabase = await getSupabaseServer();

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

    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    };

    const statusLabels = {
        hold: 'Удержано',
        confirmed: 'Подтверждено',
        paid: 'Оплачено',
        cancelled: 'Отменено',
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Бронь #{String(data.id).slice(0, 8)}</h1>
                            <p className="text-gray-600 dark:text-gray-400">Детали вашей записи</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[data.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                            {statusLabels[data.status as keyof typeof statusLabels] || data.status}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Услуга</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{service?.name_ru ?? '—'}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Мастер</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{master?.full_name ?? '—'}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Начало</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatInTimeZone(new Date(data.start_at), TZ, 'dd.MM.yyyy HH:mm')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            На главную
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

async function FallbackBooking({ id }: { id: string }) {
    const supabase = await getSupabaseServer();

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
    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    };

    const statusLabels = {
        hold: 'Удержано',
        confirmed: 'Подтверждено',
        paid: 'Оплачено',
        cancelled: 'Отменено',
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Бронь #{String(row.id).slice(0, 8)}</h1>
                            <p className="text-gray-600 dark:text-gray-400">Детали вашей записи</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[row.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                            {statusLabels[row.status as keyof typeof statusLabels] || row.status}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Услуга</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{row.service_name}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Мастер</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{row.staff_name}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Начало</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatInTimeZone(new Date(row.start_at), TZ, 'dd.MM.yyyy HH:mm')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            На главную
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

