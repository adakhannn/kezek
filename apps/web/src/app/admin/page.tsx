import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/server';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { buttonStyles } from '@/components/ui/buttonStyles';

export const dynamic = 'force-dynamic';

type BizRow = { id: string; name: string; slug: string; created_at: string };

type DashboardWarning = {
    title: string;
    description: string;
};

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
    const tzOffset = '+06:00';
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const ymd = fmt.format(new Date());
    const start = new Date(`${ymd}T00:00:00${tzOffset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: ymd };
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
    const t = await getT();
    const { startISO, endISO, label } = bishkekDayRange();
    const warnings: DashboardWarning[] = [];
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let bizCount = 0;
    let branchCount = 0;
    let staffCount = 0;
    let serviceCount = 0;
    let bookingCount = 0;
    let catCount = 0;
    let latestBiz: BizRow[] = [];
    let todayBookingsRaw: BookingRel[] = [];

    if (!SUPABASE_URL || !SERVICE) {
        warnings.push({
            title: t('admin.home.warnings.env.title', 'Админка открылась без подключения к данным'),
            description: t(
                'admin.home.warnings.env.description',
                'Проверьте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении деплоя.',
            ),
        });
    } else {
        try {
            const admin = createClient(SUPABASE_URL, SERVICE);
            const countQueries = [
                { key: 'bizCount', label: t('admin.home.stats.businesses', 'Бизнесы'), query: admin.from('businesses').select('*', { count: 'exact', head: true }) },
                { key: 'branchCount', label: t('admin.home.stats.branches', 'Филиалы'), query: admin.from('branches').select('*', { count: 'exact', head: true }) },
                { key: 'staffCount', label: t('admin.home.stats.staff', 'Сотрудники'), query: admin.from('staff').select('*', { count: 'exact', head: true }) },
                { key: 'serviceCount', label: t('admin.home.stats.services', 'Услуги'), query: admin.from('services').select('*', { count: 'exact', head: true }) },
                { key: 'bookingCount', label: t('admin.home.stats.bookings', 'Брони (всего)'), query: admin.from('bookings').select('*', { count: 'exact', head: true }) },
                { key: 'catCount', label: t('admin.home.stats.categories', 'Категории'), query: admin.from('categories').select('*', { count: 'exact', head: true }) },
            ] as const;

            const countResults = await Promise.all(countQueries.map(({ query }) => query));
            countResults.forEach((result, index) => {
                const item = countQueries[index];
                if (result.error) {
                    warnings.push({
                        title: t('admin.home.warnings.counts.title', 'Не удалось загрузить часть статистики'),
                        description: `${item.label}: ${result.error.message}`,
                    });
                    return;
                }

                const value = result.count ?? 0;
                if (item.key === 'bizCount') bizCount = value;
                if (item.key === 'branchCount') branchCount = value;
                if (item.key === 'staffCount') staffCount = value;
                if (item.key === 'serviceCount') serviceCount = value;
                if (item.key === 'bookingCount') bookingCount = value;
                if (item.key === 'catCount') catCount = value;
            });

            const latestBizResponse = await admin
                .from('businesses')
                .select('id,name,slug,created_at')
                .order('created_at', { ascending: false })
                .limit(5)
                .returns<BizRow[]>();

            if (latestBizResponse.error) {
                warnings.push({
                    title: t('admin.home.warnings.latestBusinesses.title', 'Не удалось загрузить последние бизнесы'),
                    description: latestBizResponse.error.message,
                });
            } else {
                latestBiz = latestBizResponse.data ?? [];
            }

            const todayBookingsResponse = await admin
                .from('bookings')
                .select(
                    'id,start_at,end_at,status,client_name,client_phone,' +
                        'services(name_ru),' +
                        'staff(full_name),' +
                        'businesses(id,name,slug),' +
                        'branches(name)',
                )
                .gte('start_at', startISO)
                .lt('start_at', endISO)
                .order('start_at', { ascending: true })
                .limit(20)
                .returns<BookingRel[]>();

            if (todayBookingsResponse.error) {
                warnings.push({
                    title: t('admin.home.warnings.todayBookings.title', 'Не удалось загрузить брони за сегодня'),
                    description: todayBookingsResponse.error.message,
                });
            } else {
                todayBookingsRaw = todayBookingsResponse.data ?? [];
            }
        } catch (error) {
            warnings.push({
                title: t('admin.home.warnings.unexpected.title', 'Админка открылась в ограниченном режиме'),
                description:
                    error instanceof Error
                        ? error.message
                        : t('admin.home.warnings.unexpected.description', 'Не удалось загрузить часть данных. Попробуйте обновить страницу.'),
            });
        }
    }

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
    const holdCount = statusCounts.hold ?? 0;
    const confirmedCount = statusCounts.confirmed ?? 0;
    const canceledCount = statusCounts.canceled ?? 0;

    const checks = [
        { ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, label: t('admin.home.systemChecks.serviceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY задан') },
        { ok: !!process.env.NEXT_PUBLIC_SITE_ORIGIN, label: t('admin.home.systemChecks.siteOrigin', 'NEXT_PUBLIC_SITE_ORIGIN задан') },
        {
            ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            label: t('admin.home.systemChecks.supabaseKeys', 'Публичные ключи Supabase заданы'),
        },
    ];

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl space-y-6 py-6 sm:space-y-8 sm:py-8">
                <PageHeader
                    title={t('admin.home.title', 'Панель администратора')}
                    description={t('admin.home.subtitle', 'Обзор системы и управление')}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Link href="/admin/businesses/new" className={buttonStyles({ size: 'sm' })}>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>{t('admin.home.createBusiness', 'Создать бизнес')}</span>
                            </Link>
                            <Link href="/admin/categories/new" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                                <svg className="h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span className="whitespace-nowrap">{t('admin.home.createCategory', 'Категория')}</span>
                            </Link>
                        </div>
                    }
                />

                {warnings.length > 0 ? (
                    <section className="space-y-3">
                        {warnings.map((warning, index) => (
                            <div
                                key={`${warning.title}-${index}`}
                                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                            >
                                <div className="flex gap-3">
                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                        !
                                    </div>
                                    <div>
                                        <h2 className="font-semibold">{warning.title}</h2>
                                        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{warning.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                ) : null}

                <section>
                    <SectionHeader title={t('admin.home.stats.title', 'Общая статистика')} className="mb-4" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <MetricCard
                            title={t('admin.home.stats.businesses', 'Бизнесы')}
                            value={bizCount ?? 0}
                            href="/admin/businesses"
                            icon={
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                            gradient="from-purple-500 to-pink-500"
                        />
                        <MetricCard
                            title={t('admin.home.stats.services', 'Услуги')}
                            value={serviceCount ?? 0}
                            icon={
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                </svg>
                            }
                            gradient="from-orange-500 to-red-500"
                        />
                        <MetricCard
                            title={t('admin.home.stats.bookings', 'Брони (всего)')}
                            value={bookingCount ?? 0}
                            icon={
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                            gradient="from-rose-500 to-pink-500"
                        />
                    </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    <SectionHeader
                        title={t('admin.home.bookingsToday.title', 'Брони сегодня')}
                        description={`${label} (Asia/Bishkek)`}
                        action={
                            <div className="flex flex-wrap gap-2">
                                <StatusCountChip status="hold" count={holdCount} />
                                <StatusCountChip status="confirmed" count={confirmedCount} />
                                <StatusCountChip status="canceled" count={canceledCount} />
                            </div>
                        }
                        className="mb-6"
                    />

                    {todayBookings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.time', 'Время')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.business', 'Бизнес / филиал')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.service', 'Услуга')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.master', 'Мастер')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.client', 'Клиент')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {t('admin.home.bookingsToday.table.status', 'Статус')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                                    {todayBookings.map((b) => (
                                        <tr key={b.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {fmtTimeBishkek(b.start_at)}–{fmtTimeBishkek(b.end_at)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {b.bizId ? (
                                                    <Link className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" href={`/admin/businesses/${b.bizId}`}>
                                                        {b.biz}
                                                    </Link>
                                                ) : (
                                                    <span>{b.biz}</span>
                                                )}
                                                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{b.branch}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.service}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.staff}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{b.client}</td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <StatusChip status={b.status} label={bookingStatusLabel(b.status)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            compact
                            icon={
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                            title={t('admin.home.bookingsToday.empty', 'На сегодня броней нет')}
                        />
                    )}
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                        <SectionHeader
                            title={t('admin.home.latestBusinesses.title', 'Последние бизнесы')}
                            action={
                                <Link href="/admin/businesses" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                                    {t('admin.home.latestBusinesses.all', 'Все')}
                                </Link>
                            }
                            className="mb-4"
                        />
                        {latestBiz.length > 0 ? (
                            <div className="space-y-3">
                                {latestBiz.map((b) => (
                                    <Link
                                        key={b.id}
                                        href={`/admin/businesses/${b.id}`}
                                        className="block rounded-lg border border-gray-200 p-3 transition-all duration-200 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-600 dark:hover:bg-gray-800"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900 dark:text-gray-100">{b.name}</h3>
                                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{b.slug}</p>
                                            </div>
                                            <div className="ml-4 text-xs text-gray-500 dark:text-gray-400">
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
                            <EmptyState
                                compact
                                icon={
                                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                }
                                title={t('admin.home.latestBusinesses.empty', 'Пока нет бизнесов')}
                            />
                        )}
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                        <SectionHeader title={t('admin.home.systemChecks.title', 'Системные проверки')} className="mb-4" />
                        <div className="space-y-3">
                            {checks.map((c, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                                        c.ok
                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                                    }`}
                                >
                                    <div className={`h-3 w-3 flex-shrink-0 rounded-full ${c.ok ? 'bg-green-500' : 'bg-amber-500'}`} />
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

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    <SectionHeader title={t('admin.home.quickLinks.title', 'Быстрые ссылки')} className="mb-4" />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <QuickLink href="/admin/businesses" icon="BIZ" label={t('admin.home.quickLinks.allBusinesses', 'Все бизнесы')} />
                        <QuickLink href="/admin/categories" icon="CAT" label={t('admin.home.quickLinks.categories', 'Категории')} />
                        <QuickLink href="/admin/users" icon="USR" label={t('admin.home.quickLinks.users', 'Пользователи')} />
                        <QuickLink href="/" icon="WEB" label={t('admin.home.quickLinks.publicSite', 'Публичный сайт')} />
                    </div>
                </section>
            </div>
        </main>
    );
}

function bookingStatusLabel(status: string) {
    const labels: Record<string, string> = {
        confirmed: 'Подтверждено',
        hold: 'Ожидание',
        canceled: 'Отменено',
        paid: 'Выполнено',
    };
    return labels[status] ?? status;
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
    const displayValue = typeof value === 'number' ? value.toLocaleString('ru-RU') : value;
    const inner = (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}>
            <div className="relative z-10">
                <div className="mb-2 flex items-center justify-between">
                    <div className="opacity-90">{icon}</div>
                    {hint ? <span className="rounded-full bg-white/20 px-2 py-1 text-xs opacity-75">{hint}</span> : null}
                </div>
                <div className="mb-1 text-sm font-medium opacity-90">{title}</div>
                <div className="text-3xl font-bold">{displayValue}</div>
            </div>
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-white/10" />
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

function StatusCountChip({ status, count }: { status: string; count: number }) {
    return (
        <div className="inline-flex items-center gap-2">
            <StatusChip status={status} label={bookingStatusLabel(status)} />
            <span className="rounded-full bg-[var(--surface-emphasis)] px-2.5 py-1 text-sm font-semibold text-[var(--text-primary)]">
                {count}
            </span>
        </div>
    );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <Link href={href}>
            <Card
                variant="default"
                padding="md"
                className="group flex flex-col items-center justify-center gap-2 border-gray-200 bg-gray-50 text-center transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
            >
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold tracking-wide text-indigo-700 transition-transform duration-200 group-hover:scale-110 dark:bg-indigo-950 dark:text-indigo-300">
                    {icon}
                </span>
                <span className="text-sm font-medium text-gray-700 transition-colors group-hover:text-indigo-600 dark:text-gray-300 dark:group-hover:text-indigo-400">
                    {label}
                </span>
            </Card>
        </Link>
    );
}

