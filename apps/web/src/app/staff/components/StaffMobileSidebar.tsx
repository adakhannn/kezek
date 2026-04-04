'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { WorkspaceNavItem, WorkspaceSidebarShell } from '@/app/_components/workspace/WorkspaceNavigation';

export function StaffMobileSidebar({ staffId }: { staffId: string }) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const navItems = useMemo<WorkspaceNavItem[]>(
        () => [
            {
                href: '/staff',
                label: t('staff.nav.home', 'Р“Р»Р°РІРЅР°СЏ'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                ),
                match: (currentPath) => currentPath === '/staff' || currentPath === '/staff/',
            },
            {
                href: '/staff/bookings',
                label: t('staff.nav.bookings', 'Р—Р°РїРёСЃРё'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                href: '/staff/schedule',
                label: t('staff.nav.schedule', 'Р“СЂР°С„РёРє'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                href: '/staff/finance',
                label: t('staff.nav.finance', 'Р¤РёРЅР°РЅСЃС‹'),
                icon: (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
                    </svg>
                ),
            },
        ],
        [t],
    );

    return (
        <WorkspaceSidebarShell
            title={t('staff.cabinet.title', 'РљР°Р±РёРЅРµС‚ СЃРѕС‚СЂСѓРґРЅРёРєР°')}
            subtitle={`${t('staff.cabinet.id', 'ID:')} ${staffId.slice(0, 8)}...`}
            badge={t('staff.sidebar.workspaceBadge', 'Staff Workspace')}
            items={navItems}
            pathname={pathname}
            isOpen={isOpen}
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
            openLabel={t('staff.sidebar.openMenu', 'РћС‚РєСЂС‹С‚СЊ РјРµРЅСЋ')}
            closeLabel={t('staff.sidebar.closeMenu', 'Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ')}
            navTitle={t('staff.sidebar.navTitle', 'Р Р°Р·РґРµР»С‹ workspace')}
        />
    );
}
