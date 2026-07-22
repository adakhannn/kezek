'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, type ReactNode, useEffect, useState } from 'react';

import {useLanguage} from './i18n/LanguageProvider';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';


type HomeHeroProps = {
    totalBusinesses: number;
    children: ReactNode;
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

export function HomeHero({ totalBusinesses, children }: HomeHeroProps) {
    const {t} = useLanguage();

    const steps = [
        {
            number: '01',
            title: t('home.hero.step1Title', 'Найдите место'),
            description: t('home.hero.step1Body', 'По услуге, названию или адресу'),
        },
        {
            number: '02',
            title: t('home.hero.step2Title', 'Сравните варианты'),
            description: t('home.hero.step2Body', 'По рейтингу, адресу и предложениям'),
        },
        {
            number: '03',
            title: t('home.hero.step3Title', 'Выберите время'),
            description: t('home.hero.step3Body', 'Подтвердите запись онлайн'),
        },
    ];

    return (
        <section className="relative overflow-hidden rounded-[30px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_12%_8%,rgba(99,102,241,0.2),transparent_34%),radial-gradient(circle_at_92%_88%,rgba(244,114,182,0.15),transparent_32%),linear-gradient(145deg,color-mix(in_srgb,var(--surface-card)_97%,transparent),color-mix(in_srgb,var(--surface-elevated)_94%,transparent))] p-5 shadow-[var(--shadow-lg)] sm:p-7 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[color:color-mix(in_srgb,var(--accent-secondary)_16%,transparent)]" />
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)]" />

            <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center xl:gap-12">
                <div className="min-w-0 space-y-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)] px-3 py-1.5">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
                        <span className="type-label text-[var(--text-secondary)]">
                            {t('home.hero.badge', 'Онлайн-запись без звонков')}
                        </span>
                    </div>

                    <div className="max-w-3xl space-y-3">
                        <h1 className="type-display text-[var(--text-primary)]">
                            {t('home.title', 'Найдите место и запишитесь онлайн')}
                        </h1>
                        <p className="type-body max-w-2xl text-[var(--text-secondary)] sm:text-[1.0625rem] sm:leading-7">
                            {t(
                                'home.subtitle',
                                'Сравните варианты, выберите удобное время и подтвердите запись за несколько минут.',
                            )}
                        </p>
                    </div>

                    {children}

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-2">
                            <span className="text-[var(--status-success)]" aria-hidden="true">✓</span>
                            {t('home.trust.verified', 'Проверенные профили')}
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <span className="text-[var(--status-success)]" aria-hidden="true">✓</span>
                            {t('home.trust.booking', 'Запись доступна 24/7')}
                        </span>
                    </div>
                </div>

                <aside className="hidden rounded-[26px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_82%,transparent)] p-5 shadow-[var(--shadow-md)] lg:block">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                        <div>
                            <p className="type-label text-[var(--accent-primary)]">
                                {t('home.hero.howBadge', 'Как это работает')}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                                {t('home.hero.howTitle', 'От поиска до записи — три шага')}
                            </h2>
                        </div>
                        <div className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)]">
                            {totalBusinesses} {t('home.hero.available', 'мест')}
                        </div>
                    </div>

                    <div className="mt-2 divide-y divide-[var(--border-subtle)]">
                        {steps.map((step) => (
                        <div
                            key={step.number}
                            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-4"
                        >
                            <span className="font-mono text-sm font-semibold text-[var(--accent-secondary)]">{step.number}</span>
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">{step.description}</p>
                            </div>
                        </div>
                    ))}
                    </div>

                    <Link
                        href="/map"
                        className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                    >
                        {t('home.hero.mapCta', 'Посмотреть места на карте')}
                        <span aria-hidden="true">→</span>
                    </Link>
                </aside>
            </div>
        </section>
    );
}

export function HomeHeader({q, cat, categories, totalResults}: HomeHeaderProps) {
    const {t} = useLanguage();
    const router = useRouter();
    const [query, setQuery] = useState(q);

    useEffect(() => {
        setQuery(q);
    }, [q]);

    useEffect(() => {
        const normalizedQuery = query.trim();

        if (normalizedQuery === q) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            router.replace(buildMarketplaceHref(normalizedQuery, cat));
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [cat, q, query, router]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.push(buildMarketplaceHref(query.trim(), cat));
    };

    return (
        <section
            id="marketplace-search"
            aria-labelledby="marketplace-search-title"
            className="rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] p-4 shadow-[var(--shadow-md)] sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="marketplace-search-title" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                        {t('home.search.title', 'Что вы хотите найти?')}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t('home.search.description', 'Название, услуга, адрес или район')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        {totalResults} {t('home.results.shortCount', 'вариантов')}
                    </span>
                    <Link
                        href="/map"
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] lg:hidden"
                    >
                        <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l-6 3V6l6-3m0 15 6 3m-6-3V3m6 18 6-3V3l-6 3m0 15V6" />
                        </svg>
                        {t('home.search.map', 'Карта')}
                    </Link>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <form onSubmit={handleSubmit}>
                    <div className="relative">
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
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('home.search.placeholder', 'Поиск по названию, адресу или району')}
                            aria-label={t('home.search.ariaLabel', 'Поиск бизнеса или услуги')}
                            className="min-h-[56px] w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-base)] py-3 pl-12 pr-28 text-base text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-base)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)] focus:outline-none sm:pr-32"
                        />
                        <button
                            type="submit"
                            className="absolute bottom-1.5 right-1.5 top-1.5 inline-flex min-w-[96px] items-center justify-center rounded-[14px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 text-sm font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-[var(--motion-base)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-md)]"
                        >
                            {t('home.search.submit', 'Найти')}
                        </button>
                    </div>
                    {cat ? <input type="hidden" name="cat" value={cat}/> : null}
                </form>

                {categories.length > 0 ? (
                    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="type-label shrink-0 text-[var(--text-muted)]">
                            {t('home.cats.title', 'Категории:')}
                        </span>
                        {[{ label: t('home.cats.all', 'Все'), value: '' }, ...categories.map((category) => ({ label: category, value: category }))].map((item) => (
                            <Link
                                key={item.value || 'all'}
                                href={buildMarketplaceHref(query.trim(), item.value)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                    cat === item.value
                                        ? 'border-transparent bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-inverse)] shadow-[var(--shadow-xs)]'
                                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        {(q || cat) ? (
                            <Link href="/" className="shrink-0 px-2 py-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline">
                                {t('home.search.reset', 'Сбросить')}
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

function buildMarketplaceHref(query: string, category: string): string {
    const params = new URLSearchParams();

    if (query) {
        params.set('q', query);
    }

    if (category) {
        params.set('cat', category);
    }

    const search = params.toString();
    return search ? `/?${search}` : '/';
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
