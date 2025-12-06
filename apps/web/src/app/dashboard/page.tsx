import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import Link from 'next/link';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FilterValue = string | number | boolean | null;

async function count(
    supabase: SupabaseClient,
    table: string,
    filters: { col: string; eq?: FilterValue; gte?: FilterValue; lte?: FilterValue }[] = []
): Promise<number> {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const f of filters) {
        if (f.eq !== undefined) q = q.eq(f.col, f.eq);
        if (f.gte !== undefined) q = q.gte(f.col, f.gte);
        if (f.lte !== undefined) q = q.lte(f.col, f.lte);
    }
    const { count: c } = await q;
    return c ?? 0;
}

export default async function DashboardHome() {
    const { supabase, bizId } = await getBizContextForManagers();

    // Получаем таймзону бизнеса
    const { data: biz } = await supabase
        .from('businesses')
        .select('tz')
        .eq('id', bizId)
        .maybeSingle<{ tz: string }>();

    const bizTz = biz?.tz || process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

    // Диапазон «сегодня» в TZ бизнеса
    const now = new Date();
    const todayStr = formatInTimeZone(now, bizTz, 'yyyy-MM-dd');
    // Создаём начало и конец дня в таймзоне бизнеса, затем конвертируем в UTC для запроса
    const startLocal = fromZonedTime(`${todayStr}T00:00:00`, bizTz);
    const endLocal = fromZonedTime(`${todayStr}T23:59:59.999`, bizTz);
    const start = startLocal.toISOString();
    const end = endLocal.toISOString();

    const [bookingsToday, staffActive, servicesActive, branchesCount] = await Promise.all([
        count(supabase, 'bookings', [{ col: 'biz_id', eq: bizId }, { col: 'start_at', gte: start }, { col: 'start_at', lte: end }]),
        count(supabase, 'staff', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
        count(supabase, 'services', [{ col: 'biz_id', eq: bizId }, { col: 'active', eq: true }]),
        count(supabase, 'branches', [{ col: 'biz_id', eq: bizId }, { col: 'is_active', eq: true }]),
    ]);

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Кабинет бизнеса</h1>
                    <p className="text-gray-600 dark:text-gray-400">Коротко о состоянии на сегодня</p>
                </div>

                {/* KPI блоки */}
                <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/dashboard/bookings" className="group">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Брони сегодня</div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">{bookingsToday}</div>
                            <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                                Открыть календарь →
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/staff" className="group">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Активных сотрудников</div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">{staffActive}</div>
                            <div className="text-sm text-pink-600 dark:text-pink-400 font-medium group-hover:underline">
                                Управлять сотрудниками →
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/services" className="group">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Активных услуг</div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">{servicesActive}</div>
                            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium group-hover:underline">
                                Перейти к услугам →
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/branches" className="group">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Филиалов</div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">{branchesCount}</div>
                            <div className="text-sm text-green-600 dark:text-green-400 font-medium group-hover:underline">
                                Список филиалов →
                            </div>
                        </div>
                    </Link>
                </section>

                {/* Быстрые действия */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Быстрые действия</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Link 
                            href="/dashboard/bookings" 
                            className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-900/30 dark:hover:to-indigo-800/30 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Календарь
                        </Link>
                        <Link 
                            href="/dashboard/staff/new" 
                            className="px-4 py-3 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-medium rounded-lg hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-900/30 dark:hover:to-pink-800/30 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Добавить сотрудника
                        </Link>
                        <Link 
                            href="/dashboard/services/new" 
                            className="px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-medium rounded-lg hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Добавить услугу
                        </Link>
                        <Link 
                            href="/dashboard/staff" 
                            className="px-4 py-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 font-medium rounded-lg hover:from-green-100 hover:to-green-200 dark:hover:from-green-900/30 dark:hover:to-green-800/30 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Назначить услуги
                        </Link>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                        Навигация доступна на всех страницах кабинета
                    </p>
                </section>
            </div>
        </main>
    );
}
