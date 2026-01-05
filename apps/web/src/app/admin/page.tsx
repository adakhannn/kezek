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
        {ok: !!process.env.NEXT_PUBLIC_SITE_ORIGIN, label: 'NEXT_PUBLIC_SITE_ORIGIN задан'},
        {
            ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            label: 'Публичные ключи Supabase заданы',
        },
    ];

    return (
        <main className="space-y-8 p-4">
            <section className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Панель администратора</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin/businesses/new" className="border px-3 py-1.5 rounded hover:bg-gray-50">
                        + Создать бизнес
                    </Link>
                    <Link href="/admin/categories/new" className="border px-3 py-1.5 rounded hover:bg-gray-50">
                        + Новая категория
                    </Link>
                    <Link href="/admin/users/new" className="border px-3 py-1.5 rounded hover:bg-gray-50">
                        + Новый пользователь
                    </Link>
                </div>
            </section>

            {/* Метрики */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card title="Бизнесы" value={bizCount ?? 0} href="/admin/businesses"/>
                <Card title="Филиалы" value={branchCount ?? 0} href="/admin/businesses"
                      hint="управление в карточках бизнеса"/>
                <Card title="Сотрудники" value={staffCount ?? 0}/>
                <Card title="Услуги" value={serviceCount ?? 0}/>
                <Card title="Брони (всего)" value={bookingCount ?? 0}/>
                <Card title="Категории" value={catCount ?? 0} href="/admin/categories"/>
            </section>

            {/* Сегодняшние брони */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Брони сегодня — {label} (Asia/Bishkek)</h2>
                    <div className="flex gap-2 text-xs">
                        <Badge>{`hold: ${holdCount}`}</Badge>
                        <Badge>{`confirmed: ${confirmedCount}`}</Badge>
                        <Badge>{`canceled: ${canceledCount}`}</Badge>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[880px] w-full border-collapse">
                        <thead className="text-left text-sm text-gray-500">
                        <tr>
                            <th className="border-b p-2">Время</th>
                            <th className="border-b p-2">Бизнес / филиал</th>
                            <th className="border-b p-2">Услуга</th>
                            <th className="border-b p-2">Мастер</th>
                            <th className="border-b p-2">Клиент</th>
                            <th className="border-b p-2">Статус</th>
                        </tr>
                        </thead>
                        <tbody className="text-sm">
                        {todayBookings.map((b) => (
                            <tr key={b.id}>
                                <td className="border-b p-2 whitespace-nowrap">
                                    {fmtTimeBishkek(b.start_at)}–{fmtTimeBishkek(b.end_at)}
                                </td>
                                <td className="border-b p-2">
                                    {b.bizId ? (
                                        <Link className="underline" href={`/admin/businesses/${b.bizId}`}>
                                            {b.biz}
                                        </Link>
                                    ) : (
                                        b.biz
                                    )}
                                    <div className="text-xs text-gray-500">{b.branch}</div>
                                </td>
                                <td className="border-b p-2">{b.service}</td>
                                <td className="border-b p-2">{b.staff}</td>
                                <td className="border-b p-2">{b.client}</td>
                                <td className="border-b p-2">
                    <span
                        className={`inline-block rounded px-2 py-0.5 text-xs border ${
                            b.status === 'confirmed'
                                ? 'border-green-600 text-green-700'
                                : b.status === 'hold'
                                    ? 'border-amber-600 text-amber-700'
                                    : 'border-gray-500 text-gray-700'
                        }`}
                    >
                      {b.status}
                    </span>
                                </td>
                            </tr>
                        ))}
                        {todayBookings.length === 0 && (
                            <tr>
                                <td className="p-3 text-gray-500" colSpan={6}>
                                    На сегодня броней нет.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Последние бизнесы */}
            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Последние бизнесы</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full border-collapse">
                        <thead className="text-left text-sm text-gray-500">
                        <tr>
                            <th className="border-b p-2">Название</th>
                            <th className="border-b p-2">Slug</th>
                            <th className="border-b p-2">Создан</th>
                            <th className="border-b p-2 w-32">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="text-sm">
                        {(latestBiz ?? []).map((b) => (
                            <tr key={b.id}>
                                <td className="border-b p-2">{b.name}</td>
                                <td className="border-b p-2">{b.slug}</td>
                                <td className="border-b p-2">{new Date(b.created_at).toLocaleString('ru-RU')}</td>
                                <td className="border-b p-2">
                                    <Link className="underline" href={`/admin/businesses/${b.id}`}>
                                        Открыть
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {(!latestBiz || latestBiz.length === 0) && (
                            <tr>
                                <td className="p-3 text-gray-500" colSpan={4}>
                                    Пока нет бизнесов.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Системные проверки */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Системные проверки</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                    {checks.map((c, i) => (
                        <li
                            key={i}
                            className={`rounded border p-3 text-sm ${c.ok ? 'border-green-600/40' : 'border-amber-600/40'}`}
                        >
              <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
                      c.ok ? 'bg-green-600' : 'bg-amber-600'
                  }`}
              />
                            {c.label} — {c.ok ? 'OK' : 'проверь .env'}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Быстрые ссылки */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Быстрые ссылки</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                    <Link className="border px-3 py-1.5 rounded hover:bg-gray-50" href="/admin/businesses">
                        Все бизнесы
                    </Link>
                    <Link className="border px-3 py-1.5 rounded hover:bg-gray-50" href="/admin/categories">
                        Справочник категорий
                    </Link>
                    <Link className="border px-3 py-1.5 rounded hover:bg-gray-50" href="/admin/users">
                        Пользователи
                    </Link>
                    <Link className="border px-3 py-1.5 rounded hover:bg-gray-50" href="/">
                        Публичный сайт
                    </Link>
                </div>
            </section>
        </main>
    );
}

function Card({title, value, href, hint}: { title: string; value: number | string; href?: string; hint?: string }) {
    const inner = (
        <div className="rounded-2xl border p-4 shadow-sm hover:shadow transition">
            <div className="text-sm text-gray-500">{title}</div>
            <div className="text-3xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

function Badge({children}: { children: React.ReactNode }) {
    return <span className="inline-block rounded-full border px-2 py-0.5">{children}</span>;
}
