// apps/web/src/app/admin/page.tsx
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/LanguageProvider';

export const dynamic = 'force-dynamic';

type BizRow = { id: string; name: string; slug: string; created_at: string };

type BookingRel = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string } | { name_ru: string }[] | null;
    staff: { full_name: string } | { full_name: string }[] | null;
    businesses: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    branches: { name: string } | { name: string }[] | null;
};

function bishkekDayRange() {
    // UTC+06:00, без DST
    const tzOffset = '+06:00';
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const ymd = fmt.format(new Date()); // YYYY-MM-DD
    const start = new Date(`${ymd}T00:00:00${tzOffset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {startISO: start.toISOString(), endISO: end.toISOString(), label: ymd};
}

function fmtTimeBishkek(iso: string) {
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Asia/Bishkek',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

function normRel<T>(rel: T | T[] | null | undefined): T | null {
    if (rel == null) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function AdminHomePage() {
    const t = getT('ru');
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Метрики — берём count напрямую из ответа (без any)
    const [
        {count: bizCount},
        {count: branchCount},
        {count: staffCount},
        {count: serviceCount},
        {count: bookingCount},
        {count: catCount},
    ] = await Promise.all([
        admin.from('businesses').select('*', {count: 'exact', head: true}),
        admin.from('branches').select('*', {count: 'exact', head: true}),
        admin.from('staff').select('*', {count: 'exact', head: true}),
        admin.from('services').select('*', {count: 'exact', head: true}),
        admin.from('bookings').select('*', {count: 'exact', head: true}),
        admin.from('categories').select('*', {count: 'exact', head: true}),
    ]);

    // Последние бизнесы
    const {data: latestBiz} = await admin
        .from('businesses')
        .select('id,name,slug,created_at')
        .order('created_at', {ascending: false})
        .limit(5)
        .returns<BizRow[]>();

    // Сегодняшние брони (Asia/Bishkek)
    const {startISO, endISO, label} = bishkekDayRange();

    const {data: todayBookingsRaw} = await admin
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
        .order('start_at', {ascending: true})
        .limit(20)
        .returns<BookingRel[]>()
        .throwOnError();

    const todayBookings = (todayBookingsRaw ?? []).map((r) => {
        const svc = normRel(r.services);
        const stf = normRel(r.staff);
        const biz = normRel(r.businesses);
        const br = normRel(r.branches);
        return {
            id: r.id,
            start_at: r.start_at,
            end_at: r.end_at,
            status: r.status,
            client: r.client_name || r.client_phone || '—',
            service: svc?.name_ru ?? '—',
            staff: stf?.full_name ?? '—',
            biz: biz?.name ?? '—',
            bizId: biz?.id ?? null,
            branch: br?.name ?? '—',
        };
    });

    const statusCounts = todayBookings.reduce<Record<string, number>>((acc, b) => {
        acc[b.status] = (acc[b.status] ?? 0) + 1;
        return acc;
    }, {});
    const holdCount = statusCounts['hold'] ?? 0;
    const confirmedCount = statusCounts['confirmed'] ?? 0;
    const canceledCount = statusCounts['canceled'] ?? 0;

    // Системные проверки окружения
    const checks = [
        {ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, label: t('admin.home.systemChecks.serviceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY задан')},
        {ok: !!process.env.NEXT_PUBLIC_SITE_ORIGIN, label: t('admin.home.systemChecks.siteOrigin', 'NEXT_PUBLIC_SITE_ORIGIN задан')},
        {
            ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            label: t('admin.home.systemChecks.supabaseKeys', 'Публичные ключи Supabase заданы'),
        },
    ];

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок с быстрыми действиями */}
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

                {/* Метрики */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.home.stats.title', 'Общая статистика')}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <MetricCard 
                            title={t('admin.home.stats.businesses', 'Бизнесы')} 
                            value={bizCount ?? 0} 
                            href="/admin/businesses"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            }
                            gradient="from-blue-500 to-cyan-500"
                        />
                        <MetricCard 
                            title={t('admin.home.stats.branches', 'Филиалы')} 
                            value={branchCount ?? 0} 
                            href="/admin/businesses"
                            hint={t('admin.home.stats.branchesHint', 'управление в карточках бизнеса')}
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            }
                            gradient="from-emerald-500 to-teal-500"
                        />
                        <MetricCard 
                            title={t('admin.home.stats.staff', 'Сотрудники')} 
                            value={staffCount ?? 0}
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                            gradient="from-purple-500 to-pink-500"
                        />
                        <MetricCard 
                            title={t('admin.home.stats.services', 'Услуги')} 
                            value={serviceCount ?? 0}
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                </svg>
                            }
                            gradient="from-orange-500 to-red-500"
                        />
                        <MetricCard 
                            title={t('admin.home.stats.bookings', 'Брони (всего)')} 
                            value={bookingCount ?? 0}
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                            gradient="from-indigo-500 to-purple-500"
                        />
                        <MetricCard 
                            title={t('admin.home.stats.categories', 'Категории')} 
                            value={catCount ?? 0} 
                            href="/admin/categories"
                            icon={
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                            gradient="from-rose-500 to-pink-500"
                        />
                    </div>
                </section>

                {/* Сегодняшние брони */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {t('admin.home.bookingsToday.title', 'Брони сегодня')}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {label} (Asia/Bishkek)
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <StatusBadge status="hold" count={holdCount} />
                            <StatusBadge status="confirmed" count={confirmedCount} />
                            <StatusBadge status="canceled" count={canceledCount} />
                        </div>
                    </div>

                    {todayBookings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.time', 'Время')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.business', 'Бизнес / филиал')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.service', 'Услуга')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.master', 'Мастер')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.client', 'Клиент')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.home.bookingsToday.table.status', 'Статус')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                    {todayBookings.map((b) => (
                                        <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {fmtTimeBishkek(b.start_at)}–{fmtTimeBishkek(b.end_at)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {b.bizId ? (
                                                    <Link className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${b.bizId}`}>
                                                        {b.biz}
                                                    </Link>
                                                ) : (
                                                    <span>{b.biz}</span>
                                                )}
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.branch}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.service}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.staff}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.client}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <BookingStatusBadge status={b.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('admin.home.bookingsToday.empty', 'На сегодня броней нет')}</p>
                        </div>
                    )}
                </section>

                {/* Последние бизнесы и системные проверки */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Последние бизнесы */}
                    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('admin.home.latestBusinesses.title', 'Последние бизнесы')}</h2>
                            <Link 
                                href="/admin/businesses" 
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {t('admin.home.latestBusinesses.all', 'Все')} →
                            </Link>
                        </div>
                        {(latestBiz && latestBiz.length > 0) ? (
                            <div className="space-y-3">
                                {latestBiz.map((b) => (
                                    <Link 
                                        key={b.id} 
                                        href={`/admin/businesses/${b.id}`}
                                        className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900 dark:text-gray-100">{b.name}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.slug}</p>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                                                {new Date(b.created_at).toLocaleDateString('ru-RU', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                })}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('admin.home.latestBusinesses.empty', 'Пока нет бизнесов')}</p>
                            </div>
                        )}
                    </section>

                    {/* Системные проверки */}
                    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.home.systemChecks.title', 'Системные проверки')}</h2>
                        <div className="space-y-3">
                            {checks.map((c, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                                        c.ok 
                                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
                                            : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                                    }`}
                                >
                                    <div className={`flex-shrink-0 w-3 h-3 rounded-full ${c.ok ? 'bg-green-500' : 'bg-amber-500'}`} />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</p>
                                        <p className={`text-xs ${c.ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                            {c.ok ? t('common.ok', 'ОК') : t('admin.home.systemChecks.checkEnv', 'Проверь .env')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Быстрые ссылки */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('admin.home.quickLinks.title', 'Быстрые ссылки')}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <QuickLink href="/admin/businesses" icon="🏢" label={t('admin.home.quickLinks.allBusinesses', 'Все бизнесы')} />
                        <QuickLink href="/admin/categories" icon="🏷️" label={t('admin.home.quickLinks.categories', 'Категории')} />
                        <QuickLink href="/admin/users" icon="👥" label={t('admin.home.quickLinks.users', 'Пользователи')} />
                        <QuickLink href="/" icon="🌐" label={t('admin.home.quickLinks.publicSite', 'Публичный сайт')} />
                    </div>
                </section>
            </div>
        </main>
    );
}

function MetricCard({
    title,
    value,
    href,
    hint,
    icon,
    gradient,
}: {
    title: string;
    value: number | string;
    href?: string;
    hint?: string;
    icon: React.ReactNode;
    gradient: string;
}) {
    const inner = (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1`}>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <div className="opacity-90">{icon}</div>
                    {hint && (
                        <span className="text-xs opacity-75 bg-white/20 px-2 py-1 rounded-full">
                            {hint}
                        </span>
                    )}
                </div>
                <div className="text-sm font-medium opacity-90 mb-1">{title}</div>
                <div className="text-3xl font-bold">{value.toLocaleString('ru-RU')}</div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        </div>
    );
    return href ? (
        <Link href={href} className="block">
            {inner}
        </Link>
    ) : (
        inner
    );
}

function StatusBadge({status, count}: { status: string; count: number }) {
    const config = {
        hold: { label: 'Ожидание', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
        confirmed: { label: 'Подтверждено', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700' },
        canceled: { label: 'Отменено', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' },
    };
    const { label, color } = config[status as keyof typeof config] || { label: status, color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700' };
    
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color} text-sm font-medium`}>
            <span>{label}</span>
            <span className="font-bold">{count}</span>
        </div>
    );
}

function BookingStatusBadge({status}: { status: string }) {
    const config = {
        confirmed: { label: 'Подтверждено', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700' },
        hold: { label: 'Ожидание', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
        canceled: { label: 'Отменено', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' },
        paid: { label: 'Выполнено', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700' },
    };
    const { label, color } = config[status as keyof typeof config] || { label: status, color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700' };
    
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${color}`}>
            {label}
        </span>
    );
}

function QuickLink({href, icon, label}: { href: string; icon: string; label: string }) {
    return (
        <Link 
            href={href}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 group"
        >
            <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{icon}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {label}
            </span>
        </Link>
    );
}
