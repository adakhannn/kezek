import type { Metadata } from 'next';
import Link from 'next/link';

import {HomeHero, HomeBookButtonText, HomeHeader, HomeEmptyState, HomeAboutButtonText} from './_components/HomeClientComponents';
import { getT, getServerLocale } from './_components/i18n/server';

import { HomeViewTracker } from '@/lib/analyticsTrackEvent';
import { generateAlternates } from '@/lib/seo';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

const PAGE_SIZE = 9;

type SearchParams = { q?: string; cat?: string; page?: string };

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const t = getT(locale);
    
    return {
        title: t('home.seo.title'),
        description: t('home.seo.description'),
        alternates: generateAlternates('/'),
    };
}

type Business = {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
    promotions_count?: number;
};

type BranchSummary = {
    id: string;
    biz_id: string;
};

export default async function Home({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>;
}) {
    const {q = '', cat = '', page = '1'} = (await searchParams) ?? {};
    const pageNum = Math.max(1, Number.parseInt(page || '1', 10));
    const locale = await getServerLocale();
    const t = getT(locale);

    const supabase = await createSupabaseServerClient();

    // базовый запрос по бизнесам
    let query = supabase
        .from('businesses')
        .select('id,slug,name,address,phones,categories,rating_score', {count: 'exact'})
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
    // Сортируем по рейтингу (лучшие первыми, NULL в конце), затем по имени
    query = query.range(from, to).order('rating_score', { ascending: false, nullsFirst: false }).order('name', { ascending: true });

    const {data: businesses, count} = await query;

    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const typedBusinesses: Business[] = (businesses as Business[] | null) ?? [];

    // Подсчитываем количество активных акций для каждого бизнеса
    // Оптимизация: используем один запрос с JOIN через branches для получения акций по бизнесам
    // Это избегает N+1 проблемы и уменьшает количество запросов к БД
    if (typedBusinesses.length > 0) {
        const bizIds = typedBusinesses.map(b => b.id);
        
        // Получаем филиалы для этих бизнесов
        const { data: branchesData } = await supabase
            .from('branches')
            .select('id, biz_id')
            .in('biz_id', bizIds)
            .eq('is_active', true);
        
        const branches = (branchesData ?? []) as BranchSummary[];
        
        if (branches.length > 0) {
            const branchIds = branches.map((b) => b.id);
            
            // Получаем количество акций по филиалам одним запросом
            // Используем select только branch_id для минимизации передачи данных
            const { data: promotionsCounts } = await supabase
                .from('branch_promotions')
                .select('branch_id')
                .eq('is_active', true)
                .in('branch_id', branchIds);
            
            // Группируем по biz_id в памяти (эффективно для небольшого количества записей)
            const promoCountMap = new Map<string, number>();
            const branchToBizMap = new Map<string, string>();
            branches.forEach((b) => {
                branchToBizMap.set(b.id, b.biz_id);
            });
            
            if (promotionsCounts) {
                for (const promo of promotionsCounts) {
                    const bizId = branchToBizMap.get(promo.branch_id);
                    if (bizId) {
                        promoCountMap.set(bizId, (promoCountMap.get(bizId) || 0) + 1);
                    }
                }
            }
            
            // Добавляем counts к бизнесам
            typedBusinesses.forEach(b => {
                b.promotions_count = promoCountMap.get(b.id) || 0;
            });
        }
    }

    // Собираем список доступных категорий из текущей выдачи
    const categoriesAvailable = Array.from(
        new Set(
            typedBusinesses
                .flatMap((b) => b.categories ?? [])
                .filter((c) => !!c)
        )
    ).sort();

    // Home — серверный компонент, для текстов используем клиентский подкомпонент, чтобы читать язык из контекста
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            {/* Клиентский трекер для события home_view */}
            <HomeViewTracker />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <HomeHero />

                <HomeHeader q={q} cat={cat} categories={categoriesAvailable} />

                <div className="flex justify-center">
                    <Link
                        href="/map"
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {t('common.map.title', 'Карта филиалов')}
                    </Link>
                </div>

                <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {typedBusinesses.map((b, index) => (
                        <article 
                            key={b.id} 
                            className="group animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="h-full bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md hover:shadow-xl border border-gray-200 dark:border-gray-800 transition-all duration-300 hover:-translate-y-1 flex flex-col">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                <Link href={`/b/${b.slug}`} className="hover:underline">
                                                    {b.name}
                                                </Link>
                                            </h2>
                                            {(b.rating_score === null || b.rating_score === undefined) ? (
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('common.rating.noRating', 'Нет рейтинга')}</span>
                                                </div>
                                            ) : (
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${b.rating_score <= 10 ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30' : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'}`}>
                                                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{Number(b.rating_score).toFixed(1)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {b.promotions_count && b.promotions_count > 0 && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                        {b.promotions_count} {b.promotions_count === 1 ? 'акция' : b.promotions_count < 5 ? 'акции' : 'акций'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
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

                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-2">
                                    <Link
                                        href={`/b/${b.slug}`} 
                                        className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all duration-200"
                                    >
                                        <HomeAboutButtonText />
                                    </Link>
                                    <Link
                                        href={`/b/${b.slug}/booking`} 
                                        className="inline-flex items-center justify-center flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 group"
                                    >
                                        <HomeBookButtonText />
                                        <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>

                {(!businesses || businesses.length === 0) && <HomeEmptyState />}

                <Pagination q={q} cat={cat} page={pageNum} pages={pages}/>
            </div>
        </main>
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

