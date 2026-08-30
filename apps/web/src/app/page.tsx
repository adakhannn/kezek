import type { Metadata } from 'next';
import Link from 'next/link';

import {
    HomeAboutButtonText,
    HomeBookButtonText,
    HomeEmptyState,
    HomeHeader,
    HomeHero,
    HomeResultsHeader,
} from './_components/HomeClientComponents';
import { getT, getServerLocale, type I18nKey } from './_components/i18n/server';

import { Badge } from '@/components/ui/Badge';
import { HomeViewTracker } from '@/lib/analyticsTrackEvent';
import { logWarn } from '@/lib/log';
import { generateAlternates } from '@/lib/seo';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

const PAGE_SIZE = 9;

type SearchParams = { q?: string; cat?: string; page?: string };

function formatPublicRatingScore(score: number): string {
    const normalizedScore = score > 5 ? score / 20 : score;
    const safeScore = Math.min(5, Math.max(0, normalizedScore));

    return safeScore.toFixed(1);
}

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
    contact_phone: string | null;
    categories: string[] | null;
    rating_score: number | null;
    promotions_count?: number;
};

type BranchSummary = {
    id: string;
    biz_id: string;
};

type Translator = <K extends I18nKey>(key: K, fallback?: string) => string;

export default async function Home({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>;
}) {
    const { q = '', cat = '', page = '1' } = (await searchParams) ?? {};
    const pageNum = Math.max(1, Number.parseInt(page || '1', 10));
    const locale = await getServerLocale();
    const t = getT(locale);

    let total = 0;
    let pages = 1;
    let typedBusinesses: Business[] = [];
    let categoriesAvailable: string[] = [];
    let serviceUnavailable = false;

    try {
        const supabase = await createSupabaseServerClient();

        let query = supabase
            .from('businesses')
            .select('id,slug,name,address,phones,contact_phone,categories,rating_score', { count: 'exact' })
            .eq('is_approved', true);

        if (q) {
            const safeQ = q.trim().slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`);
            const searchPattern = `%${safeQ}%`;
            query = query.or(`name.ilike.${searchPattern},address.ilike.${searchPattern}`);
        }

        if (cat) {
            query = query.contains('categories', [cat]);
        }

        const from = (pageNum - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        query = query
            .range(from, to)
            .order('rating_score', { ascending: false, nullsFirst: false })
            .order('name', { ascending: true });

        const { data: businesses, count, error: businessesError } = await query;

        if (businessesError) {
            throw businessesError;
        }

        total = count ?? 0;
        pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        typedBusinesses = (businesses as Business[] | null) ?? [];

        if (typedBusinesses.length > 0) {
            const bizIds = typedBusinesses.map((business) => business.id);

            const { data: branchesData, error: branchesError } = await supabase
                .from('branches')
                .select('id, biz_id')
                .in('biz_id', bizIds)
                .eq('is_active', true);

            if (branchesError) {
                throw branchesError;
            }

            const branches = (branchesData ?? []) as BranchSummary[];

            if (branches.length > 0) {
                const branchIds = branches.map((branch) => branch.id);

                const { data: promotionsCounts, error: promotionsError } = await supabase
                    .from('branch_promotions')
                    .select('branch_id')
                    .eq('is_active', true)
                    .in('branch_id', branchIds);

                if (promotionsError) {
                    throw promotionsError;
                }

                const promoCountMap = new Map<string, number>();
                const branchToBizMap = new Map<string, string>();

                branches.forEach((branch) => {
                    branchToBizMap.set(branch.id, branch.biz_id);
                });

                if (promotionsCounts) {
                    for (const promo of promotionsCounts) {
                        const bizId = branchToBizMap.get(promo.branch_id);
                        if (bizId) {
                            promoCountMap.set(bizId, (promoCountMap.get(bizId) || 0) + 1);
                        }
                    }
                }

                typedBusinesses.forEach((business) => {
                    business.promotions_count = promoCountMap.get(business.id) || 0;
                });
            }
        }

        categoriesAvailable = Array.from(
            new Set(
                typedBusinesses
                    .flatMap((business) => business.categories ?? [])
                    .filter(Boolean),
            ),
        ).sort();

    } catch (error) {
        serviceUnavailable = true;
        logWarn('Home', 'Marketplace data is unavailable', error);
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.07),transparent_26%),linear-gradient(180deg,var(--surface-canvas),color-mix(in_srgb,var(--surface-muted)_72%,var(--surface-canvas)))]">
            <HomeViewTracker />
            <div className="mx-auto flex w-full max-w-[var(--container-xl)] flex-col gap-7 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <HomeHero totalBusinesses={total}>
                    <HomeHeader
                        q={q}
                        cat={cat}
                        categories={categoriesAvailable}
                        totalResults={total}
                    />
                </HomeHero>

                <section className="space-y-6">
                    <div className="space-y-5">
                        <HomeResultsHeader totalResults={total} q={q} cat={cat} />

                        {typedBusinesses.length > 0 ? (
                            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {typedBusinesses.map((business, index) => (
                                    <MarketplaceBusinessCard
                                        key={business.id}
                                        business={business}
                                        activeCategory={cat}
                                        query={q}
                                        index={index}
                                        t={t}
                                    />
                                ))}
                            </section>
                        ) : serviceUnavailable ? (
                            <section
                                role="alert"
                                data-testid="marketplace-service-unavailable"
                                className="rounded-[24px] border border-amber-300 bg-amber-50 px-5 py-5 text-amber-900 shadow-[var(--shadow-sm)] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                            >
                                <h3 className="type-section-title">Каталог временно недоступен</h3>
                                <p className="type-body mt-2">
                                    Не удалось загрузить данные. Обновите страницу или попробуйте ещё раз позже.
                                </p>
                            </section>
                        ) : (
                            <HomeEmptyState q={q} cat={cat} />
                        )}
                    </div>

                    <Pagination q={q} cat={cat} page={pageNum} pages={pages} />
                </section>

                <BusinessAudienceSection t={t} />
            </div>
        </main>
    );
}

function MarketplaceBusinessCard({
    business,
    activeCategory,
    query,
    index,
    t,
}: {
    business: Business;
    activeCategory: string;
    query: string;
    index: number;
    t: Translator;
}) {
    const hasRating = typeof business.rating_score === 'number';
    const initial = business.name.trim().charAt(0).toUpperCase() || 'K';

    return (
        <article
            className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_96%,transparent)] p-4 shadow-[var(--shadow-sm)] transition-all duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--accent-primary)_28%,var(--border-subtle))] hover:shadow-[var(--shadow-md)] sm:p-5"
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_58%),var(--surface-emphasis)] text-lg font-bold text-[var(--accent-primary)]">
                    {initial}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                        <h2 className="min-w-0 break-words text-lg font-semibold leading-snug text-[var(--text-primary)]">
                            <Link href={`/b/${business.slug}`} className="transition-colors hover:text-[var(--accent-primary)]">
                                {business.name}
                            </Link>
                        </h2>
                        <div
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                hasRating
                                    ? 'border-[color:color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning)_14%,transparent)] text-[var(--status-warning)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]'
                            }`}
                            aria-label={hasRating ? `${t('home.card.rating', 'Рейтинг')} ${formatPublicRatingScore(Number(business.rating_score))}` : undefined}
                        >
                            <span aria-hidden="true">{hasRating ? '★' : '—'}</span>
                            <span>{hasRating ? formatPublicRatingScore(Number(business.rating_score)) : t('home.card.new', 'Новый')}</span>
                        </div>
                    </div>

                    {business.address ? (
                        <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm text-[var(--text-secondary)]">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="break-words">{business.address}</span>
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="accent">{t('home.card.badge', 'Проверенный')}</Badge>
                {business.promotions_count ? (
                    <Badge variant="success">
                        {business.promotions_count} {t('home.card.promotions', 'акции')}
                    </Badge>
                ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {(business.categories ?? []).slice(0, 4).map((category) => (
                    <Link
                        key={category}
                        href={`/?cat=${encodeURIComponent(category)}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            activeCategory === category
                                ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)] shadow-[var(--shadow-xs)]'
                                : 'border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                        }`}
                    >
                        {category}
                    </Link>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] bg-[var(--surface-emphasis)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" aria-hidden="true" />
                    {t('home.card.onlineBooking', 'Онлайн-запись')}
                </span>
                {business.contact_phone ? (
                    <span className="min-w-0 truncate">{business.contact_phone}</span>
                ) : null}
            </div>

            <div className="mt-4 flex flex-1 items-end">
                <div className="flex w-full gap-2 border-t border-[var(--border-subtle)] pt-4">
                    <Link
                        href={`/b/${business.slug}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-[var(--motion-base)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                    >
                        <HomeAboutButtonText />
                    </Link>
                    <Link
                        href={`/b/${business.slug}/booking`}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-md)]"
                    >
                        <HomeBookButtonText />
                        <span className="ml-1.5" aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}

function BusinessAudienceSection({ t }: { t: Translator }) {
    const benefits = [
        t('home.business.feature1', 'Онлайн-расписание'),
        t('home.business.feature2', 'Клиентская база'),
        t('home.business.feature3', 'Команда и финансы'),
    ];

    return (
        <section className="relative overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface-card)_96%,transparent),color-mix(in_srgb,var(--surface-emphasis)_78%,var(--surface-card)))] p-6 shadow-[var(--shadow-md)] sm:p-8">
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-[color:color-mix(in_srgb,var(--accent-secondary)_10%,transparent)] blur-2xl" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-center">
                <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--accent-secondary)]" aria-hidden="true" />
                        {t('home.business.badge', 'Для бизнеса и команды')}
                    </div>
                    <h2 className="type-page-title mt-4 text-[var(--text-primary)]">
                        {t('home.business.title', 'Принимайте записи и управляйте расписанием в одном месте')}
                    </h2>
                    <p className="type-body mt-3 max-w-xl text-[var(--text-secondary)]">
                        {t('home.business.description', 'Создайте страницу бизнеса, настройте услуги и освободите команду от ручной записи в мессенджерах.')}
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Link
                            href="/business/apply"
                            className="inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-3 text-sm font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]"
                        >
                            {t('home.business.connect', 'Подключить бизнес')}
                        </Link>
                        <Link
                            href="/auth/sign-in?redirect=/business/role-apply"
                            className="inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        >
                            {t('home.business.join', 'Присоединиться к команде')}
                        </Link>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {benefits.map((benefit, index) => (
                        <div key={benefit} className="flex items-center gap-3 rounded-[16px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_90%,transparent)] px-4 py-3.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-emphasis)] text-xs font-bold text-[var(--accent-primary)]">
                                {index + 1}
                            </span>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{benefit}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

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
    if (pages <= 1) {
        return null;
    }

    const mk = (nextPage: number) =>
        `/?page=${nextPage}${q ? `&q=${encodeURIComponent(q)}` : ''}${cat ? `&cat=${encodeURIComponent(cat)}` : ''}`;

    return (
        <nav className="mx-auto w-full max-w-xl rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_92%,transparent)] p-5 shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between gap-3">
                <Link
                    href={page <= 1 ? '#' : mk(page - 1)}
                    aria-disabled={page <= 1}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all ${
                        page <= 1
                            ? 'cursor-not-allowed border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]'
                            : 'border border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                    }`}
                >
                    {`← ${'Назад'}`}
                </Link>

                <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-2 text-center">
                    <div className="type-label text-[var(--text-primary)]">
                        {`Страница ${page}`}
                    </div>
                    <div className="type-caption text-[var(--text-muted)]">
                        {`из ${pages}`}
                    </div>
                </div>

                <Link
                    href={page >= pages ? '#' : mk(page + 1)}
                    aria-disabled={page >= pages}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all ${
                        page >= pages
                            ? 'cursor-not-allowed border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]'
                            : 'border border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                    }`}
                >
                    {`${'Вперёд'} →`}
                </Link>
            </div>
        </nav>
    );
}
