'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type NavItem = {
    href: string;
    labelKey: string;
    icon: React.ReactNode;
};

const navItems: NavItem[] = [
    {
        href: '/staff',
        labelKey: 'staff.nav.home',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        href: '/staff/bookings',
        labelKey: 'staff.nav.bookings',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        href: '/staff/schedule',
        labelKey: 'staff.nav.schedule',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        href: '/staff/finance',
        labelKey: 'staff.nav.finance',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
            </svg>
        ),
    },
];

export function StaffMobileSidebar({ staffId }: { staffId: string }) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Закрываем сайдбар при изменении маршрута
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Блокируем скролл body когда сайдбар открыт
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Кнопка открытия сайдбара (только на мобильных) */}
            <button
                onClick={() => setIsOpen(true)}
                className={`lg:hidden fixed top-2 left-4 z-[100] p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    isOpen ? 'hidden' : ''
                }`}
                aria-label={t('staff.sidebar.openMenu', 'Открыть меню')}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Overlay (только на мобильных) */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-[90]"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Сайдбар - выезжает слева */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-[95] w-64 lg:w-[280px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl lg:shadow-sm transform transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <div className="h-full overflow-y-auto">
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* Заголовок с кнопкой закрытия на мобильных */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                    {t('staff.cabinet.title', 'Кабинет сотрудника')}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.cabinet.id', 'ID:')} {staffId.slice(0, 8)}...
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="lg:hidden p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                aria-label={t('staff.sidebar.closeMenu', 'Закрыть меню')}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Навигация */}
                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const isActive = 
                                    (item.href === '/staff' && (pathname === '/staff' || pathname === '/staff/')) ||
                                    (item.href !== '/staff' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                            isActive
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {item.icon}
                                        {t(item.labelKey, '')}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </aside>
        </>
    );
}

