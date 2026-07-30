'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLanguage, type I18nKey } from '@/app/_components/i18n/LanguageProvider';

type NavItem = {
    href: string;
    labelKey: I18nKey;
    fallback: string;
    icon: React.ReactNode;
    variant?: 'default' | 'outline';
};

type NavSection = {
    key: string;
    titleKey: I18nKey;
    titleFallback: string;
    items: NavItem[];
};

const iconClasses = 'h-4 w-4';

const homeItem: NavItem = {
    href: '/admin',
    labelKey: 'admin.nav.home',
    fallback: 'Главная',
    icon: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    ),
};

const operationsSection: NavSection = {
    key: 'operations',
    titleKey: 'admin.nav.section.operations',
    titleFallback: 'Операции',
    items: [
        {
            href: '/admin/businesses',
            labelKey: 'admin.nav.businesses',
            fallback: 'Бизнесы',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
        {
            href: '/admin/business-applications',
            labelKey: 'admin.nav.businessApplications',
            fallback: 'Заявки бизнеса',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                </svg>
            ),
        },
        {
            href: '/admin/role-applications',
            labelKey: 'admin.nav.roleApplications',
            fallback: 'Заявки доступа',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/businesses/new',
            labelKey: 'admin.nav.createBusinessManually',
            fallback: 'Создать бизнес вручную',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6m15 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/categories',
            labelKey: 'admin.nav.categories',
            fallback: 'Категории',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
            ),
        },
        {
            href: '/admin/users',
            labelKey: 'admin.nav.users',
            fallback: 'Пользователи',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/roles',
            labelKey: 'admin.nav.roles',
            fallback: 'Роли',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
        },
    ],
};

const qualitySection: NavSection = {
    key: 'quality',
    titleKey: 'admin.nav.section.quality',
    titleFallback: 'Качество И Репутация',
    items: [
        {
            href: '/admin/rating-config',
            labelKey: 'admin.nav.ratings',
            fallback: 'Рейтинг: правила',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            ),
        },
        {
            href: '/admin/ratings-status',
            labelKey: 'admin.nav.ratingsHealth',
            fallback: 'Рейтинг: состояние',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/promotions-debug',
            labelKey: 'admin.nav.promotionsDebug',
            fallback: 'Промо-диагностика',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            ),
        },
    ],
};

const analyticsSection: NavSection = {
    key: 'analytics',
    titleKey: 'admin.nav.section.analytics',
    titleFallback: 'Аналитика',
    items: [
        {
            href: '/admin/analytics/overview',
            labelKey: 'admin.nav.analytics',
            fallback: 'Обзор',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            href: '/admin/analytics/system',
            labelKey: 'admin.nav.systemAnalytics',
            fallback: 'Системная аналитика',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3V3zm3 8h12v4H6v-4zm4 8h4v4h-4v-4z" />
                </svg>
            ),
        },
        {
            href: '/admin/funnel-analytics',
            labelKey: 'admin.nav.funnelAnalytics',
            fallback: 'Воронка',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                </svg>
            ),
        },
    ],
};

const diagnosticsSection: NavSection = {
    key: 'diagnostics',
    titleKey: 'admin.nav.section.diagnostics',
    titleFallback: 'Мониторинг И Диагностика',
    items: [
        {
            href: '/admin/monitoring',
            labelKey: 'admin.nav.monitoring',
            fallback: 'Мониторинг',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            href: '/admin/performance',
            labelKey: 'admin.nav.performance',
            fallback: 'Performance',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
        },
        {
            href: '/admin/system-health',
            labelKey: 'admin.nav.systemHealth',
            fallback: 'Здоровье системы',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/health-check',
            labelKey: 'admin.nav.healthCheck',
            fallback: 'Health check',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/ratings-debug',
            labelKey: 'admin.nav.ratingsDebug',
            fallback: 'Ratings debug',
            icon: (
                <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            ),
        },
    ],
};

const sections: NavSection[] = [operationsSection, qualitySection, analyticsSection, diagnosticsSection];
const primaryItems: NavItem[] = [
    homeItem,
    operationsSection.items[0],
    operationsSection.items[1],
    operationsSection.items[2],
    analyticsSection.items[0],
];
const toSiteItem: NavItem = {
    href: '/',
    labelKey: 'admin.nav.toSite',
    fallback: 'На сайт',
    variant: 'outline',
    icon: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
    ),
};

export function AdminNav() {
    const { t } = useLanguage();
    const pathname = usePathname();
    const [isSectionsOpen, setIsSectionsOpen] = useState(false);
    const sectionsRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setIsSectionsOpen(false);
    }, [pathname]);

    useEffect(() => {
        function onClickOutside(event: MouseEvent) {
            if (!sectionsRef.current) return;
            if (!sectionsRef.current.contains(event.target as Node)) {
                setIsSectionsOpen(false);
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const isItemActive = (item: NavItem): boolean => {
        if (item.href === '/admin') return pathname === '/admin';
        if (item.href === '/admin/businesses' && pathname === '/admin/businesses/new') return false;
        return pathname.startsWith(item.href);
    };

    const hasActiveInSections = sections.some((section) => section.items.some(isItemActive));

    function renderItem(item: NavItem) {
        const isActive = isItemActive(item);

        return (
            <Link
                key={item.href}
                href={item.href}
                className={`
                    inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                    ${
                        item.variant === 'outline'
                            ? isActive
                                ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-600 dark:hover:bg-gray-800'
                            : isActive
                              ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-indigo-400'
                    }
                `}
            >
                {item.icon}
                <span>{t(item.labelKey, item.fallback)}</span>
            </Link>
        );
    }

    function renderSectionsGrid() {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                {sections.map((section) => (
                    <div key={section.key} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t(section.titleKey, section.titleFallback)}
                        </div>
                        <div className="flex flex-col gap-1">
                            {section.items.map((item) => {
                                const active = isItemActive(item);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`
                                            inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors
                                            ${
                                                active
                                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                                            }
                                        `}
                                    >
                                        {item.icon}
                                        <span>{t(item.labelKey, item.fallback)}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="relative" ref={sectionsRef}>
            <nav className="hidden items-center gap-1 xl:flex">
                {primaryItems.map(renderItem)}

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsSectionsOpen((prev) => !prev)}
                        className={`
                            inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                            ${
                                hasActiveInSections
                                    ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                                    : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-indigo-400'
                            }
                        `}
                    >
                        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span>{t('admin.nav.sections')}</span>
                    </button>

                    {isSectionsOpen ? (
                        <div className="absolute right-0 z-50 mt-2 w-[540px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                            {renderSectionsGrid()}
                        </div>
                    ) : null}
                </div>

                {renderItem(toSiteItem)}
            </nav>

            <div className="xl:hidden">
                <button
                    type="button"
                    onClick={() => setIsSectionsOpen((previous) => !previous)}
                    aria-expanded={isSectionsOpen}
                    aria-controls="admin-tablet-menu"
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                    <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span>{t('admin.nav.sections')}</span>
                    <svg className={`h-4 w-4 transition-transform ${isSectionsOpen ? 'rotate-180' : ''}`} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isSectionsOpen ? (
                    <div
                        id="admin-tablet-menu"
                        className="absolute right-0 z-50 mt-2 max-h-[min(70vh,42rem)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                    >
                        <div className="mb-3 grid gap-1 sm:grid-cols-2">
                            {renderItem(homeItem)}
                            {renderItem(toSiteItem)}
                        </div>
                        {renderSectionsGrid()}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

