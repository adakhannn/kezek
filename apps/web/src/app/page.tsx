import Link from 'next/link';

import { getSupabaseServer } from '@/lib/authBiz';

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

    const supabase = await getSupabaseServer();

    // базовый запрос по бизнесам
    let query = supabase
        .from('businesses')
        .select('id,slug,name,address,phones,categories', {count: 'exact'})
        .eq('is_approved', true);

    if (q) {
        // Безопасный поиск: экранируем специальные символы и ограничиваем длину
        const safeQ = q.trim().slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`);
        const searchPattern = `%${safeQ}%`;
        query = query.or(`name.ilike.${searchPattern},address.ilike.${searchPattern}`);
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
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="text-center space-y-4 animate-fade-in">
                    <h1 className="text-4xl sm:text-5xl font-bold">
                        <span className="gradient-text">Найдите свой сервис</span>
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Быстрая запись в сервисы города Ош
                    </p>
                </div>

                <Header q={q} cat={cat}/>

                <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(businesses as Business[] | null ?? []).map((b, index) => (
                        <article 
                            key={b.id} 
                            className="group animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="h-full bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md hover:shadow-xl border border-gray-200 dark:border-gray-800 transition-all duration-300 hover:-translate-y-1 flex flex-col">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            <Link href={`/b/${b.slug}`} className="hover:underline">
                                                {b.name}
                                            </Link>
                                        </h2>
                                        {b.address && (
                                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                {b.address}
                                            </div>
                                        )}
                                        {b.phones?.length ? (
                                            <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1.5 mt-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {b.phones.join(', ')}
                                            </div>
                                        ) : null}
                                    </div>
                                    
                                    {b.categories && b.categories.length > 0 && (
                                        <div className="flex gap-2 flex-wrap">
                                            {(b.categories ?? []).map((c) => (
                                                <Link
                                                    key={c}
                                                    href={`/?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                                                        cat === c
                                                            ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {c}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                                    <Link 
                                        href={`/b/${b.slug}`} 
                                        className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 group"
                                    >
                                        Записаться
                                        <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>

                {(!businesses || businesses.length === 0) && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">Ничего не найдено</p>
                    </div>
                )}

                <Pagination q={q} cat={cat} page={pageNum} pages={pages}/>
            </div>
        </main>
    );
}

/* ---------- поиск/фильтры в шапке ---------- */
function Header({q, cat}: { q: string; cat: string }) {
    return (
        <div className="max-w-3xl mx-auto">
            <form className="flex items-center gap-3">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Поиск по названию или адресу..."
                        className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                    />
                </div>
                {cat && <input type="hidden" name="cat" value={cat}/>}
                <button 
                    type="submit"
                    className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Искать
                </button>
                {q && (
                    <Link 
                        href="/" 
                        className="px-4 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        Сброс
                    </Link>
                )}
            </form>
        </div>
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
        <nav className="flex items-center gap-3 justify-center">
            <Link
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    page <= 1
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md'
                }`}
                aria-disabled={page <= 1}
                href={page <= 1 ? '#' : mk(page - 1)}
            >
                <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Назад
                </span>
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Страница <span className="text-indigo-600 dark:text-indigo-400 font-bold">{page}</span> из <span className="font-bold">{pages}</span>
                </span>
            </div>
            <Link
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    page >= pages
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md'
                }`}
                aria-disabled={page >= pages}
                href={page >= pages ? '#' : mk(page + 1)}
            >
                <span className="flex items-center gap-1.5">
                    Вперёд
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </span>
            </Link>
        </nav>
    );
}
