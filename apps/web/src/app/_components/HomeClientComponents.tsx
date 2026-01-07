'use client';

import Link from 'next/link';

import {useLanguage} from './i18n/LanguageProvider';

export function HomeHero() {
    const {t} = useLanguage();
    return (
        <div className="animate-fade-in space-y-4 text-center">
            <h1 className="text-4xl font-bold sm:text-5xl">
                <span className="gradient-text">{t('home.title', 'Найдите свой сервис')}</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
                {t(
                    'home.subtitle',
                    'Запись в салоны и студии города Ош за пару кликов — без звонков и переписок'
                )}
            </p>
        </div>
    );
}

export function HomeBookButtonText() {
    const {t} = useLanguage();
    return <>{t('home.card.book', 'Записаться')}</>;
}

export function HomeHeader({q, cat, categories}: { q: string; cat: string; categories: string[] }) {
    const {t} = useLanguage();
    return (
        <div className="max-w-4xl mx-auto space-y-3">
            <form className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        placeholder={t('home.search.placeholder', 'Поиск по названию или адресу...')}
                        className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                    />
                </div>
                {cat && <input type="hidden" name="cat" value={cat}/>}
                <button
                    type="submit"
                    className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    {t('home.search.submit', 'Искать')}
                </button>
                {q && (
                    <Link
                        href="/"
                        className="px-4 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        {t('home.search.reset', 'Сброс')}
                    </Link>
                )}
            </form>

            {categories.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {t('home.cats.title', 'Популярные категории:')}
                    </span>
                    <Link
                        href={q ? `/?q=${encodeURIComponent(q)}` : '/'}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            !cat
                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-transparent shadow-sm'
                                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                    >
                        {t('home.cats.all', 'Все')}
                    </Link>
                    {categories.map((c) => (
                        <Link
                            key={c}
                            href={`/?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                cat === c
                                    ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-transparent shadow-sm'
                                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                        >
                            {c}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export function HomeEmptyState() {
    const {t} = useLanguage();
    return (
        <div className="py-12 text-center">
            <p className="text-lg text-gray-500 dark:text-gray-400">{t('home.empty', 'Ничего не найдено')}</p>
        </div>
    );
}

