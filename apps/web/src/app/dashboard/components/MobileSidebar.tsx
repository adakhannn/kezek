'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { BusinessSwitcher } from './BusinessSwitcher';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { WorkspaceNavItem, WorkspaceSidebarShell } from '@/app/_components/workspace/WorkspaceNavigation';

export function MobileSidebar({ bizId }: { bizId: string }) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const navItems = useMemo<WorkspaceNavItem[]>(
        () => [
            {
                href: '/dashboard',
                label: t('dashboard.nav.home', 'Главная'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                ),
                match: (currentPath) => currentPath === '/dashboard',
            },
            {
                href: '/dashboard/bookings',
                label: t('dashboard.nav.bookings', 'Брони'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/staff',
                label: t('dashboard.nav.staff', 'Сотрудники'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/finance',
                label: t('dashboard.nav.finance', 'Финансы'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/analytics',
                label: t('dashboard.nav.analytics', 'Аналитика'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/role-applications',
                label: t('dashboard.nav.roleApplications', 'Заявки доступа'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/services',
                label: t('dashboard.nav.services', 'Услуги'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/branches',
                label: t('dashboard.nav.branches', 'Филиалы'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/visit-packages',
                label: t('dashboard.nav.visitPackages', 'Пакеты'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                ),
            },
        ],
        [t],
    );

    return (
        <WorkspaceSidebarShell
            title={t('dashboard.sidebar.title', 'Кабинет бизнеса')}
            subtitle={`ID: ${bizId.slice(0, 8)}...`}
            badge={t('dashboard.sidebar.workspaceBadge', 'Owner Workspace')}
            items={navItems}
            pathname={pathname}
            isOpen={isOpen}
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
            openLabel={t('dashboard.sidebar.openMenu', 'Открыть меню')}
            closeLabel={t('dashboard.sidebar.closeMenu', 'Закрыть меню')}
            navTitle={t('dashboard.sidebar.navTitle', 'Разделы workspace')}
            headerSlot={<BusinessSwitcher serverCurrentBizId={bizId} />}
        />
    );
}

