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

    const supabase = await createSupabaseServerClient();

    let query = supabase
        .from('businesses')
        .select('id,slug,name,address,phones,categories,rating_score', { count: 'exact' })
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

    const { data: businesses, count } = await query;

    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const typedBusinesses: Business[] = (businesses as Business[] | null) ?? [];

    if (typedBusinesses.length > 0) {
        const bizIds = typedBusinesses.map((business) => business.id);

        const { data: branchesData } = await supabase
            .from('branches')
            .select('id, biz_id')
            .in('biz_id', bizIds)
            .eq('is_active', true);

        const branches = (branchesData ?? []) as BranchSummary[];

        if (branches.length > 0) {
            const branchIds = branches.map((branch) => branch.id);

            const { data: promotionsCounts } = await supabase
                .from('branch_promotions')
                .select('branch_id')
                .eq('is_active', true)
                .in('branch_id', branchIds);

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

    const categoriesAvailable = Array.from(
        new Set(
            typedBusinesses
                .flatMap((business) => business.categories ?? [])
                .filter(Boolean),
        ),
    ).sort();

    const ratedBusinesses = typedBusinesses.filter((business) => typeof business.rating_score === 'number').length;

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.07),transparent_26%),linear-gradient(180deg,var(--surface-canvas),color-mix(in_srgb,var(--surface-muted)_72%,var(--surface-canvas)))]">
            <HomeViewTracker />
            <div className="mx-auto flex w-full max-w-[var(--container-2xl)] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <HomeHero
                    totalBusinesses={total}
                    ratedBusinesses={ratedBusinesses}
                    categoriesCount={categoriesAvailable.length}
                />

                <HomeHeader
                    q={q}
                    cat={cat}
                    categories={categoriesAvailable}
                    totalResults={total}
                />

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-6">
                        <HomeResultsHeader totalResults={total} q={q} cat={cat} />

                        {typedBusinesses.length > 0 ? (
                            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                        ) : (
                            <HomeEmptyState q={q} cat={cat} />
                        )}
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                        <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_92%,transparent)] p-5 shadow-[var(--shadow-md)]">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] px-3 py-1.5">
                                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
                                <span className="type-label text-[var(--accent-primary)]">
                                    {t('home.marketplace.trustBadge', 'Почему пользователи выбирают Kezek')}
                                </span>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <h2 className="type-section-title text-[var(--text-primary)]">
                                        {t('home.marketplace.trustTitle', 'Прозрачный выбор и быстрый переход к записи')}
                                    </h2>
                                    <p className="type-body mt-2 text-[var(--text-secondary)]">
                                        {t(
                                            'home.marketplace.trustDescription',
                                            'Сначала пользователь понимает, куда он идёт и почему можно доверять бизнесу, а потом уже бронирует удобный слот.',
                                        )}
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {[
                                        {
                                            title: t('home.marketplace.point1Title', 'Понятные карточки'),
                                            body: t(
                                                'home.marketplace.point1Body',
                                                'Рейтинг, акции, контакты и категории видны сразу, без лишних переходов.',
                                            ),
                                        },
                                        {
                                            title: t('home.marketplace.point2Title', 'Быстрая навигация'),
                                            body: t(
                                                'home.marketplace.point2Body',
                                                'Поиск, фильтры и карта помогают быстро сузить выбор под реальную задачу.',
                                            ),
                                        },
                                        {
                                            title: t('home.marketplace.point3Title', 'Конверсия без трения'),
                                            body: t(
                                                'home.marketplace.point3Body',
                                                'Из карточки можно сразу перейти к подробностям или в поток записи.',
                                            ),
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.title}
                                            className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4"
                                        >
                                            <h3 className="type-label text-[var(--text-primary)]">{item.title}</h3>
                                            <p className="type-caption mt-2 text-[var(--text-secondary)]">
                                                {item.body}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <Link
                                    href="/map"
                                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-[var(--motion-base)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                                >
                                    {t('common.map.title', 'Карта филиалов')}
                                </Link>
                            </div>
                        </div>

                        <Pagination q={q} cat={cat} page={pageNum} pages={pages} />
                    </aside>
                </section>
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

    return (
        <article
            className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] p-5 shadow-[var(--shadow-md)] transition-all duration-[var(--motion-base)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="accent">
                            {t('home.card.badge', 'Проверенный бизнес')}
                        </Badge>
                        {business.promotions_count ? (
                            <Badge variant="success">
                                {business.promotions_count}{' '}
                                {t('home.card.promotions', 'акции')}
                            </Badge>
                        ) : null}
                    </div>

                    <div>
                        <h2 className="type-section-title text-[var(--text-primary)]">
                            <Link href={`/b/${business.slug}`} className="transition-colors hover:text-[var(--accent-primary)]">
                                {business.name}
                            </Link>
                        </h2>
                        {business.address ? (
                            <p className="type-caption mt-2 text-[var(--text-secondary)]">
                                {business.address}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        hasRating
                            ? 'border-[color:color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning)_14%,transparent)] text-[var(--status-warning-strong)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]'
                    }`}
                >
                    <span aria-hidden="true">{hasRating ? '★' : '•'}</span>
                    {hasRating
                        ? Number(business.rating_score).toFixed(1)
                        : t('common.rating.noRating', 'Нет рейтинга')}
                </div>
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

            <div className="mt-5 grid gap-3 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                <TrustRow
                    label={t('home.card.trust1', 'Доверие')}
                    value={
                        hasRating
                            ? t('home.card.trust1Value', 'Рейтинг и доверие видны сразу')
                            : t('home.card.trust1Fallback', 'Карточка готова к знакомству и записи')
                    }
                />
                <TrustRow
                    label={t('home.card.trust2', 'Контакт')}
                    value={business.phones?.join(', ') || t('home.card.trust2Fallback', 'Контакты уточняются в карточке')}
                />
                <TrustRow
                    label={t('home.card.trust3', 'Сценарий')}
                    value={t('home.card.trust3Value', 'Можно изучить детали и сразу перейти к записи')}
                />
            </div>

            <div className="mt-5 flex flex-1 items-end">
                <div className="flex w-full flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row">
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
                    </Link>
                </div>
            </div>
        </article>
    );
}

function TrustRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-secondary)]" />
            <div>
                <div className="type-label text-[var(--text-primary)]">{label}</div>
                <p className="type-caption mt-1 text-[var(--text-secondary)]">{value}</p>
            </div>
        </div>
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
        <nav className="rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_92%,transparent)] p-5 shadow-[var(--shadow-md)]">
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
