'use client';

import { usePathname } from 'next/navigation';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { WorkspaceNavItem, WorkspaceNavList } from '@/app/_components/workspace/WorkspaceNavigation';

function useDashboardItems(t: (key: string, fallback?: string) => string): WorkspaceNavItem[] {
    return [
        {
            href: '/dashboard',
            label: t('dashboard.nav.home', 'Р“Р»Р°РІРЅР°СЏ'),
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            match: (pathname) => pathname === '/dashboard',
        },
        {
            href: '/dashboard/bookings',
            label: t('dashboard.nav.bookings', 'Р‘СЂРѕРЅРё'),
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            href: '/dashboard/staff',
            label: t('dashboard.nav.staff', 'РЎРѕС‚СЂСѓРґРЅРёРєРё'),
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
        },
        {
            href: '/dashboard/services',
            label: t('dashboard.nav.services', 'РЈСЃР»СѓРіРё'),
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            ),
        },
        {
            href: '/dashboard/branches',
            label: t('dashboard.nav.branches', 'Р¤РёР»РёР°Р»С‹'),
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
    ];
}

export default function DashboardNav() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const items = useDashboardItems(t);

    return <WorkspaceNavList items={items} pathname={pathname} />;
}
