'use client';

import Link from 'next/link';

import {useLanguage} from './i18n/LanguageProvider';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';


type HomeHeroProps = {
    totalBusinesses: number;
    ratedBusinesses: number;
    categoriesCount: number;
};

type HomeHeaderProps = {
    q: string;
    cat: string;
    categories: string[];
    totalResults: number;
};

type HomeResultsHeaderProps = {
    totalResults: number;
    q: string;
    cat: string;
};

export function HomeHero({ totalBusinesses, ratedBusinesses, categoriesCount }: HomeHeroProps) {
    const {t} = useLanguage();

    const trustItems = [
        t('home.trust.verified', 'Проверенные бизнесы и филиалы'),
        t('home.trust.ratings', 'Понятные рейтинги и отзывы'),
        t('home.trust.booking', 'Быстрая запись без лишних звонков'),
    ];

    const stats = [
        {
            value: totalBusinesses,
            label: t('home.hero.stats.businesses', 'бизнесов на платформе'),
        },
        {
            value: ratedBusinesses,
            label: t('home.hero.stats.rated', 'с рейтингом и социальным доверием'),
        },
        {
            value: categoriesCount,
            label: t('home.hero.stats.categories', 'категорий для поиска'),
        },
    ];

    return (
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.16),transparent_28%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-card)_94%,transparent),color-mix(in_srgb,var(--surface-elevated)_96%,transparent))] px-6 py-8 shadow-[var(--shadow-lg)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
                <div className="max-w-3xl space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)] px-3 py-1.5">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
                        <span className="type-label text-[var(--text-secondary)]">
                            {t('home.hero.badge', 'Marketplace для записи и выбора сервиса')}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <h1 className="type-display max-w-3xl text-balance text-[var(--text-primary)]">
                            {t('home.title', 'Найдите сервис, которому можно доверить своё время')}
                        </h1>
                        <p className="type-body max-w-2xl text-[var(--text-secondary)] sm:text-[1.0625rem] sm:leading-7">
                            {t(
                                'home.subtitle',
                                'Kezek помогает быстро найти подходящий бизнес, увидеть рейтинг, сравнить категории и сразу записаться в понятном клиентском потоке.',
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="#marketplace-search"
                            className="inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-md)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-lg)]"
                        >
                            {t('home.hero.primaryCta', 'Начать поиск')}
                        </Link>
                        <Link
                            href="/map"
                            className="inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface-card)_82%,transparent)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-base)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        >
                            {t('common.map.title', 'Карта филиалов')}
                        </Link>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        {trustItems.map((item) => (
                            <div
                                key={item}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_86%,transparent)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                            >
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-secondary)]" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)] p-4 shadow-[var(--shadow-sm)]"
                        >
                            <div className="type-metric text-[var(--text-primary)]">{stat.value}</div>
                            <p className="type-caption mt-2 text-[var(--text-muted)]">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function HomeHeader({q, cat, categories, totalResults}: HomeHeaderProps) {
    const {t} = useLanguage();

    return (
        <section
            id="marketplace-search"
            className="rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_92%,transparent)] p-5 shadow-[var(--shadow-md)] sm:p-6"
        >
            <SectionHeader
                title={t('home.search.title', 'Подберите сервис под свой запрос')}
                description={t(
                    'home.search.description',
                    'Ищите по названию, адресу и категориям, а затем переходите в карточку бизнеса с понятной записью.',
                )}
                badge={
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-info)]" />
                        {t('home.search.badge', 'Умный поиск и фильтры')}
                    </span>
                }
                action={
                    <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                        {t('home.results.count', 'Результатов')}: {totalResults}
                    </div>
                }
            />

            <div className="mt-5 space-y-4">
                <form className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder={t('home.search.placeholder', 'Поиск по названию, адресу или району')}
                            className="w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-base)] py-4 pl-12 pr-4 text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-base)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)] focus:outline-none"
                        />
                    </div>
                    {cat ? <input type="hidden" name="cat" value={cat}/> : null}
                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-none">
                        <button
                            type="submit"
                            className="inline-flex min-h-[52px] items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-6 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-md)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-lg)]"
                        >
                            {t('home.search.submit', 'Искать')}
                        </button>
                        {(q || cat) ? (
                            <Link
                                href="/"
                                className="inline-flex min-h-[52px] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-[var(--motion-base)] hover:border-[var(--border-default)]"
                            >
                                {t('home.search.reset', 'Сбросить')}
                            </Link>
                        ) : null}
                    </div>
                </form>

                {categories.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="type-label text-[var(--text-muted)]">
                            {t('home.cats.title', 'Категории')}
                        </span>
                        <Link
                            href={q ? `/?q=${encodeURIComponent(q)}` : '/'}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                !cat
                                    ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)] shadow-[var(--shadow-xs)]'
                                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                            }`}
                        >
                            {t('home.cats.all', 'Все')}
                        </Link>
                        {categories.map((category) => (
                            <Link
                                key={category}
                                href={`/?cat=${encodeURIComponent(category)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                    cat === category
                                        ? 'border-transparent bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-inverse)] shadow-[var(--shadow-xs)]'
                                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                                }`}
                            >
                                {category}
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export function HomeResultsHeader({ totalResults, q, cat }: HomeResultsHeaderProps) {
    const { t } = useLanguage();

    const activeFilters = [
        q ? `${t('home.results.query', 'Поиск')}: ${q}` : null,
        cat ? `${t('home.results.category', 'Категория')}: ${cat}` : null,
    ].filter(Boolean) as string[];

    return (
        <SectionHeader
            title={t('home.results.title', 'Подходящие бизнесы')}
            description={t(
                'home.results.description',
                'Выбирайте по доверию, рейтингу, категориям и доступной записи в одном месте.',
            )}
            action={
                <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                        {t('home.results.count', 'Найдено')}: {totalResults}
                    </div>
                    {activeFilters.map((filter) => (
                        <div
                            key={filter}
                            className="rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--accent-primary)]"
                        >
                            {filter}
                        </div>
                    ))}
                </div>
            }
        />
    );
}

export function HomeEmptyState({ q, cat }: { q: string; cat: string }) {
    const {t} = useLanguage();

    return (
        <EmptyState
            title={t('home.empty.title', 'Ничего не найдено')}
            description={
                q || cat
                    ? t('home.empty.filtered', 'Попробуйте убрать часть фильтров или изменить поисковый запрос.')
                    : t('home.empty', 'Сейчас в каталоге пока нет доступных бизнесов.')
            }
            action={
                q || cat ? (
                    <Link
                        href="/"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)]"
                    >
                        {t('home.search.reset', 'Сбросить')}
                    </Link>
                ) : undefined
            }
        />
    );
}

export function HomeBookButtonText() {
    const {t} = useLanguage();
    return <>{t('home.card.book', 'Записаться')}</>;
}

export function HomeAboutButtonText() {
    const {t} = useLanguage();
    return <>{t('home.card.about', 'О бизнесе')}</>;
}
