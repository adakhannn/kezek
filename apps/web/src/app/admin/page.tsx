import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/server';
import { AdminBookingStatusBadge, AdminStatusBadge } from './AdminBadges';
import { AdminMetricCard } from './AdminMetricCard';
import {
    AdminBookingsTodaySection,
    AdminLatestBusinessesSection,
    AdminQuickLinksSection,
    AdminSystemChecksSection,
} from './AdminSections';
import type { BizRow, BookingRel, SystemCheck } from './adminTypes';
import { bishkekDayRange, mapTodayBookings } from './adminUtils';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
    const t = getT('ru');
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [
        { count: bizCount },
        { count: branchCount },
        { count: staffCount },
        { count: serviceCount },
        { count: bookingCount },
        { count: catCount },
    ] = await Promise.all([
        admin.from('businesses').select('*', { count: 'exact', head: true }),
        admin.from('branches').select('*', { count: 'exact', head: true }),
        admin.from('staff').select('*', { count: 'exact', head: true }),
        admin.from('services').select('*', { count: 'exact', head: true }),
        admin.from('bookings').select('*', { count: 'exact', head: true }),
        admin.from('categories').select('*', { count: 'exact', head: true }),
    ]);

    const { data: latestBiz } = await admin
        .from('businesses')
        .select('id,name,slug,created_at')
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<BizRow[]>();

    const { startISO, endISO, label } = bishkekDayRange();

    const { data: todayBookingsRaw } = await admin
        .from('bookings')
        .select(
            'id,start_at,end_at,status,client_name,client_phone,' +
                'services(name_ru),' +
                'staff(full_name),' +
                'businesses(id,name,slug),' +
                'branches(name)'
        )
        .gte('start_at', startISO)
        .lt('start_at', endISO)
        .order('start_at', { ascending: true })
        .limit(20)
        .returns<BookingRel[]>()
        .throwOnError();

    const todayBookings = mapTodayBookings(todayBookingsRaw ?? []);
    const statusCounts = todayBookings.reduce<Record<string, number>>((acc, booking) => {
        acc[booking.status] = (acc[booking.status] ?? 0) + 1;
        return acc;
    }, {});

    const checks: SystemCheck[] = [
        {
            ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            label: t('admin.home.systemChecks.serviceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY задан'),
        },
        {
            ok: !!process.env.NEXT_PUBLIC_SITE_ORIGIN,
            label: t('admin.home.systemChecks.siteOrigin', 'NEXT_PUBLIC_SITE_ORIGIN задан'),
        },
        {
            ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            label: t('admin.home.systemChecks.supabaseKeys', 'Публичные ключи Supabase заданы'),
        },
    ];

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                            {t('admin.home.title', 'Панель администратора')}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t('admin.home.subtitle', 'Обзор системы и управление')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/businesses/new"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('admin.home.createBusiness', 'Создать бизнес')}
                        </Link>
                        <Link
                            href="/admin/categories/new"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {t('admin.home.createCategory', 'Категория')}
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('admin.home.stats.title', 'Общая статистика')}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <AdminMetricCard
                            title={t('admin.home.stats.businesses', 'Бизнесы')}
                            value={bizCount ?? 0}
                            href="/admin/businesses"
                            gradient="from-blue-500 to-cyan-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            }
                        />
                        <AdminMetricCard
                            title={t('admin.home.stats.branches', 'Филиалы')}
                            value={branchCount ?? 0}
                            href="/admin/businesses"
                            hint={t('admin.home.stats.branchesHint', 'управление в карточках бизнеса')}
                            gradient="from-emerald-500 to-teal-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            }
                        />
                        <AdminMetricCard
                            title={t('admin.home.stats.staff', 'Сотрудники')}
                            value={staffCount ?? 0}
                            gradient="from-purple-500 to-pink-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                        />
                        <AdminMetricCard
                            title={t('admin.home.stats.services', 'Услуги')}
                            value={serviceCount ?? 0}
                            gradient="from-orange-500 to-red-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                </svg>
                            }
                        />
                        <AdminMetricCard
                            title={t('admin.home.stats.bookings', 'Брони (всего)')}
                            value={bookingCount ?? 0}
                            gradient="from-indigo-500 to-purple-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                        />
                        <AdminMetricCard
                            title={t('admin.home.stats.categories', 'Категории')}
                            value={catCount ?? 0}
                            href="/admin/categories"
                            gradient="from-rose-500 to-pink-500"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                        />
                    </div>
                </section>

                <AdminBookingsTodaySection
                    t={t}
                    label={label}
                    holdCount={statusCounts.hold ?? 0}
                    confirmedCount={statusCounts.confirmed ?? 0}
                    canceledCount={statusCounts.canceled ?? 0}
                    todayBookings={todayBookings}
                    StatusBadges={
                        <>
                            <AdminStatusBadge status="hold" count={statusCounts.hold ?? 0} />
                            <AdminStatusBadge status="confirmed" count={statusCounts.confirmed ?? 0} />
                            <AdminStatusBadge status="canceled" count={statusCounts.canceled ?? 0} />
                        </>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-2">
                    <AdminLatestBusinessesSection t={t} latestBiz={latestBiz ?? []} />
                    <AdminSystemChecksSection t={t} checks={checks} />
                </div>

                <AdminQuickLinksSection t={t} />
            </div>
        </main>
    );
}
