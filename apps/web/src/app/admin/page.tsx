// apps/web/src/app/admin/page.tsx
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';

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
        {ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, label: 'SUPABASE_SERVICE_ROLE_KEY задан'},
        {ok: !!process.env.NEXT_PUBLIC_SITE_URL, label: 'NEXT_PUBLIC_SITE_URL задан'},
        {
            ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            label: 'Публичные ключи Supabase заданы',
        },
    ];

    return (
        <main className="space-y-8">
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Панель администратора</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление системой и данными</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/admin/businesses/new" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Создать бизнес
                        </Link>
                        <Link href="/admin/categories/new" className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Новая категория
                        </Link>
                        <Link href="/admin/users/new" className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Новый пользователь
                        </Link>
                    </div>
                </div>
            </section>

            {/* Метрики */}
            <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card title="Бизнесы" value={bizCount ?? 0} href="/admin/businesses" icon="building" color="indigo"/>
                <Card title="Филиалы" value={branchCount ?? 0} href="/admin/businesses" hint="управление в карточках бизнеса" icon="map" color="green"/>
                <Card title="Сотрудники" value={staffCount ?? 0} icon="users" color="pink"/>
                <Card title="Услуги" value={serviceCount ?? 0} icon="briefcase" color="purple"/>
                <Card title="Брони (всего)" value={bookingCount ?? 0} icon="calendar" color="blue"/>
                <Card title="Категории" value={catCount ?? 0} href="/admin/categories" icon="tag" color="yellow"/>
            </section>

            {/* Сегодняшние брони */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Брони сегодня</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{label} (Asia/Bishkek)</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Badge color="yellow">{`hold: ${holdCount}`}</Badge>
                        <Badge color="green">{`confirmed: ${confirmedCount}`}</Badge>
                        <Badge color="gray">{`canceled: ${canceledCount}`}</Badge>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[880px] w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Время</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Бизнес / филиал</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Услуга</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Мастер</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Клиент</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Статус</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {todayBookings.map((b) => (
                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {fmtTimeBishkek(b.start_at)}–{fmtTimeBishkek(b.end_at)}
                                </td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                                    {b.bizId ? (
                                        <Link className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${b.bizId}`}>
                                            {b.biz}
                                        </Link>
                                    ) : (
                                        <span className="font-medium">{b.biz}</span>
                                    )}
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.branch}</div>
                                </td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{b.service}</td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{b.staff}</td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{b.client}</td>
                                <td className="p-3">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            b.status === 'confirmed'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : b.status === 'hold'
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                        }`}
                                    >
                                        {b.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {todayBookings.length === 0 && (
                            <tr>
                                <td className="p-6 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                                    На сегодня броней нет.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Последние бизнесы */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Последние бизнесы</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Название</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Slug</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">Создан</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-32">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(latestBiz ?? []).map((b) => (
                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300 font-mono">{b.slug}</td>
                                <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{new Date(b.created_at).toLocaleString('ru-RU')}</td>
                                <td className="p-3">
                                    <Link className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${b.id}`}>
                                        Открыть
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {(!latestBiz || latestBiz.length === 0) && (
                            <tr>
                                <td className="p-6 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                                    Пока нет бизнесов.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Системные проверки */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Системные проверки</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {checks.map((c, i) => (
                        <li
                            key={i}
                            className={`rounded-lg border p-4 flex items-center gap-3 ${
                                c.ok
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            }`}
                        >
                            <span
                                className={`flex-shrink-0 w-3 h-3 rounded-full ${
                                    c.ok ? 'bg-green-600' : 'bg-yellow-600'
                                }`}
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.label}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">{c.ok ? 'OK' : 'проверь .env'}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Быстрые ссылки */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Быстрые ссылки</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Link className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm text-center" href="/admin/businesses">
                        Все бизнесы
                    </Link>
                    <Link className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm text-center" href="/admin/categories">
                        Справочник категорий
                    </Link>
                    <Link className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm text-center" href="/admin/users">
                        Пользователи
                    </Link>
                    <Link className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm text-center" href="/">
                        Публичный сайт
                    </Link>
                </div>
            </section>
        </main>
    );
}

function Card({
    title,
    value,
    href,
    hint,
    icon,
    color = 'indigo',
}: {
    title: string;
    value: number | string;
    href?: string;
    hint?: string;
    icon?: string;
    color?: 'indigo' | 'green' | 'pink' | 'purple' | 'blue' | 'yellow';
}) {
    const colorClasses = {
        indigo: 'from-indigo-500 to-indigo-600 text-indigo-600 dark:text-indigo-400',
        green: 'from-green-500 to-green-600 text-green-600 dark:text-green-400',
        pink: 'from-pink-500 to-pink-600 text-pink-600 dark:text-pink-400',
        purple: 'from-purple-500 to-purple-600 text-purple-600 dark:text-purple-400',
        blue: 'from-blue-500 to-blue-600 text-blue-600 dark:text-blue-400',
        yellow: 'from-yellow-500 to-yellow-600 text-yellow-600 dark:text-yellow-400',
    };

    const iconMap: Record<string, React.ReactElement> = {
        building: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
        map: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
        ),
        users: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        ),
        briefcase: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        calendar: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        tag: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
        ),
    };

    const inner = (
        <div className="group bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-r ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]} rounded-xl flex items-center justify-center shadow-md text-white`}>
                    {icon && iconMap[icon]}
                </div>
                {href && (
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                )}
            </div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</div>
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{value}</div>
            {hint && <div className="text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

function Badge({children, color = 'gray'}: { children: React.ReactNode; color?: 'yellow' | 'green' | 'gray' }) {
    const colorClasses = {
        yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses[color]}`}>{children}</span>;
}
