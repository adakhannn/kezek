'use client';

import { usePathname } from 'next/navigation';

export function AppShellHeaderFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

    return (
        <header className={`${isAdminRoute ? 'relative' : 'sticky top-0'} z-[100] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6`}>
            {children}
        </header>
    );
}
