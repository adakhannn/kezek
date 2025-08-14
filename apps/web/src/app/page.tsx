import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';
import Link from 'next/link';

import SlotButton, { type QuickPayload } from '@/components/SlotButton';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';
const PAGE_SIZE = 6;

type SearchParams = { q?: string; cat?: string; page?: string };

type Business = {
    id: string;
    slug: string;
    name: string;
    address: string;
    phones: string[] | null;
    categories: string[] | null;
};

type ServiceShort = { id: string; name_ru: string; duration_min: number };

type SlotItem = { staff_id: string; start_at: string; end_at: string };

type Card = {
    b: Business;
    svc: ServiceShort | null;
    todaySlots: SlotItem[];
    tomorrowSlots: SlotItem[];
};

type SlotProps = { label: string; payload: QuickPayload };
function Slot({ label, payload }: SlotProps) {
    return <SlotButton label={label} payload={payload} />;
}

export default async function Home({
                                       searchParams,
                                   }: {
    searchParams?: Promise<SearchParams>;
}) {
    const { q = '', cat = '', page = '1' } = (await searchParams) ?? {};
    const pageNum = Math.max(1, Number.parseInt(page || '1', 10));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n) => cookieStore.get(n)?.value },
    });

    // базовый запрос по бизнесам
    let query = supabase
        .from('businesses')
        .select('id,slug,name,address,phones,categories', { count: 'exact' })
        .eq('is_approved', true);

    if (q) {
        // поиск по имени/адресу
        query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
    }
    if (cat) {
        // фильтр по категории
        query = query.contains('categories', [cat]);
    }

    // пагинация
    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to).order('name');

    const { data: businesses, count } = await query;

    // собираем карточки с короткой услугой и быстрыми слотами
    const cards: Card[] = await Promise.all(
        (businesses as Business[] | null ?? []).map(async (b) => {
            const { data: svc } = await supabase
                .from('services')
                .select('id,name_ru,duration_min')
                .eq('biz_id', b.id)
                .eq('active', true)
                .order('duration_min', { ascending: true })
                .limit(1)
                .maybeSingle<ServiceShort>();

            let todaySlots: SlotItem[] = [];
            let tomorrowSlots: SlotItem[] = [];

            if (svc?.id) {
                const today = new Date();
                const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                const dayStr = (d: Date) => formatInTimeZone(d, TZ, 'yyyy-MM-dd');

                const [{ data: s1 }, { data: s2 }] = await Promise.all([
                    supabase.rpc('get_free_slots_service_day', {
                        p_biz_id: b.id,
                        p_service_id: svc.id,
                        p_day: dayStr(today),
                        p_per_staff: 2,
                        p_step_min: 15,
                        p_tz: TZ,
                    }),
                    supabase.rpc('get_free_slots_service_day', {
                        p_biz_id: b.id,
                        p_service_id: svc.id,
                        p_day: dayStr(tomorrow),
                        p_per_staff: 2,
                        p_step_min: 15,
                        p_tz: TZ,
                    }),
                ]);

                todaySlots = (s1 as SlotItem[] | null) ?? [];
                tomorrowSlots = (s2 as SlotItem[] | null) ?? [];
            }

            return { b, svc: svc ?? null, todaySlots, tomorrowSlots };
        })
    );

    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <Header q={q} cat={cat} />

            <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(({ b, svc, todaySlots, tomorrowSlots }) => (
                    <article key={b.id} className="border rounded p-4 space-y-3">
                        <div>
                            <h2 className="text-xl font-semibold">
                                <Link href={`/b/${b.slug}`}>{b.name}</Link>
                            </h2>
                            <div className="text-sm text-gray-600">{b.address}</div>
                            <div className="mt-1 text-xs flex gap-2 flex-wrap">
                                {(b.categories ?? []).map((c) => (
                                    <Link
                                        key={c}
                                        href={`/?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                                        className={`px-2 py-0.5 border rounded ${cat === c ? 'bg-gray-100' : ''}`}
                                    >
                                        {c}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {svc ? (
                            <div className="text-sm">
                                <div className="font-medium mb-1">Быстрые слоты (услуга: {svc.name_ru})</div>
                                <div className="mb-2">
                                    <div className="text-xs text-gray-500 mb-1">Сегодня</div>
                                    <div className="flex flex-wrap gap-2">
                                        {todaySlots.length === 0 && <span className="text-gray-400">нет</span>}
                                        {todaySlots.slice(0, 6).map((s, i) => (
                                            <Slot
                                                key={`t${i}`}
                                                label={formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}
                                                payload={{
                                                    biz_id: b.id,
                                                    service_id: svc.id,
                                                    staff_id: s.staff_id,
                                                    start_at: s.start_at,
                                                    slug: b.slug,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Завтра</div>
                                    <div className="flex flex-wrap gap-2">
                                        {tomorrowSlots.length === 0 && <span className="text-gray-400">нет</span>}
                                        {tomorrowSlots.slice(0, 6).map((s, i) => (
                                            <Slot
                                                key={`z${i}`}
                                                label={formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}
                                                payload={{
                                                    biz_id: b.id,
                                                    service_id: svc.id,
                                                    staff_id: s.staff_id,
                                                    start_at: s.start_at,
                                                    slug: b.slug,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">Нет активных услуг</div>
                        )}

                        <div>
                            <Link href={`/b/${b.slug}`} className="border px-3 py-1 rounded inline-block">
                                Открыть
                            </Link>
                        </div>
                    </article>
                ))}
            </section>

            <Pagination q={q} cat={cat} page={pageNum} pages={pages} />
        </main>
    );
}

/* ---------- поиск/фильтры в шапке ---------- */
function Header({ q, cat }: { q: string; cat: string }) {
    return (
        <form className="flex items-center gap-2">
            <input
                name="q"
                defaultValue={q}
                placeholder="Поиск: имя или адрес"
                className="border px-3 py-1 rounded w-full"
            />
            {cat && <input type="hidden" name="cat" value={cat} />}
            <button className="border px-3 py-1 rounded">Искать</button>
            <Link href="/" className="px-3 py-1 border rounded">
                Сброс
            </Link>
        </form>
    );
}

/* ---------- пагинация ---------- */
function Pagination({
                        q,
                        cat,
                        page,
                        pages,
                    }: {
    q: string;
    cat: string;
    page: number;
    pages: number;
}) {
    if (pages <= 1) return null;
    const mk = (p: number) =>
        `/?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}${cat ? `&cat=${encodeURIComponent(cat)}` : ''}`;
    return (
        <nav className="flex items-center gap-2 justify-center">
            <Link
                className="border px-2 py-1 rounded disabled:opacity-50"
                aria-disabled={page <= 1}
                href={page <= 1 ? '#' : mk(page - 1)}
            >
                Назад
            </Link>
            <span className="text-sm">
        {page} / {pages}
      </span>
            <Link
                className="border px-2 py-1 rounded disabled:opacity-50"
                aria-disabled={page >= pages}
                href={page >= pages ? '#' : mk(page + 1)}
            >
                Вперёд
            </Link>
        </nav>
    );
}
