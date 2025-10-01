import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import Link from 'next/link';

const PAGE_SIZE = 9;

type SearchParams = { q?: string; cat?: string; page?: string };

type Business = {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
};

export default async function Home({
                                       searchParams,
                                   }: {
    searchParams?: Promise<SearchParams>;
}) {
    const {q = '', cat = '', page = '1'} = (await searchParams) ?? {};
    const pageNum = Math.max(1, Number.parseInt(page || '1', 10));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: {get: (n) => cookieStore.get(n)?.value},
    });

    // базовый запрос по бизнесам
    let query = supabase
        .from('businesses')
        .select('id,slug,name,address,phones,categories', {count: 'exact'})
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

    const {data: businesses, count} = await query;

    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <Header q={q} cat={cat}/>

            <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(businesses as Business[] | null ?? []).map((b) => (
                    <article key={b.id} className="border rounded p-4 space-y-3">
                        <div>
                            <h2 className="text-xl font-semibold">
                                <Link href={`/b/${b.slug}`}>{b.name}</Link>
                            </h2>
                            {b.address && <div className="text-sm text-gray-600">{b.address}</div>}
                            {b.phones?.length ? (
                                <div className="text-xs text-gray-500">
                                    {b.phones.join(', ')}
                                </div>
                            ) : null}
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

                        <div>
                            <Link href={`/b/${b.slug}`} className="border px-3 py-1 rounded inline-block">
                                Открыть
                            </Link>
                        </div>
                    </article>
                ))}
            </section>

            <Pagination q={q} cat={cat} page={pageNum} pages={pages}/>
        </main>
    );
}

/* ---------- поиск/фильтры в шапке ---------- */
function Header({q, cat}: { q: string; cat: string }) {
    return (
        <form className="flex items-center gap-2">
            <input
                name="q"
                defaultValue={q}
                placeholder="Поиск: имя или адрес"
                className="border px-3 py-1 rounded w-full"
            />
            {cat && <input type="hidden" name="cat" value={cat}/>}
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
