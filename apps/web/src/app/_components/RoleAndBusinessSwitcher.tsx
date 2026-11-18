'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

import type { ShellAccount } from '@/lib/shellAccount';
import { supabase } from '@/lib/supabaseClient';

type RoleAndBusinessSwitcherProps = {
    /** The signed-in account as the server rendered it; null when signed out. */
    account: ShellAccount | null;
    mode?: 'desktop' | 'mobile';
    onNavigate?: () => void;
};

type CabinetLink = {
    href: '/dashboard' | '/staff' | '/cabinet' | '/admin';
    label: string;
};

function matchesCabinet(pathname: string, href: CabinetLink['href']) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function RoleAndBusinessSwitcher({
    account,
    mode = 'desktop',
    onNavigate,
}: RoleAndBusinessSwitcherProps) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [sessionChanged, setSessionChanged] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const isMobile = mode === 'mobile';
    const accountId = account?.userId ?? null;

    useEffect(() => {
        if (!accountId) return;
        // The server renders the switcher for one account (the header remounts it per account after
        // AuthStatusUpdater refreshes). Until then, a sign-out or another account must not see these cabinets.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
            if ((session?.user?.id ?? null) === accountId) return;
            setIsOpen(false);
            setSessionChanged(true);
        });
        return () => subscription.unsubscribe();
    }, [accountId]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const container = containerRef.current;
            if (container && event.target instanceof Node && !container.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                if (containerRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    if (!account || sessionChanged) return null;

    const { roles } = account;
    const cabinetLinks: CabinetLink[] = [];
    if (roles.hasDashboard) cabinetLinks.push({ href: '/dashboard', label: t('header.businessCabinet') });
    if (roles.hasStaff) cabinetLinks.push({ href: '/staff', label: t('header.staffCabinet') });
    if (roles.hasCabinet) cabinetLinks.push({ href: '/cabinet', label: t('header.myBookings') });
    if (roles.hasAdmin) cabinetLinks.push({ href: '/admin', label: t('header.adminPanel') });

    const currentCabinet = cabinetLinks.find((link) => matchesCabinet(pathname, link.href));
    let controlLabel = currentCabinet?.label ?? t('header.roleBusiness.client');
    if (!currentCabinet) {
        if (roles.hasAdmin) controlLabel = t('header.roleBusiness.admin');
        else if (roles.hasDashboard) controlLabel = t('header.roleBusiness.owner');
        else if (roles.hasStaff) controlLabel = t('header.roleBusiness.staff');
    }

    const handleNavigate = () => {
        setIsOpen(false);
        onNavigate?.();
    };

    return (
        <div className={clsx(isMobile ? 'w-full' : 'hidden md:block')} ref={containerRef}>
            <div className="relative">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setIsOpen((previous) => !previous)}
                    className={clsx(
                        'inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:border-[var(--border-default)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                        isMobile ? 'w-full justify-between px-3.5 py-3' : 'px-3.5 py-2',
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                >
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span className="truncate">{controlLabel}</span>
                    </span>
                    <svg
                        aria-hidden="true"
                        className={clsx('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path d="M6 8l4 4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {isOpen ? (
                    <div
                        role="menu"
                        className={clsx(
                            'z-[120] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] shadow-[var(--shadow-lg)] backdrop-blur-xl',
                            isMobile ? 'mt-2 w-full' : 'absolute right-0 mt-3 w-72',
                        )}
                    >
                        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                            <p className="type-label text-[var(--text-primary)]">
                                {t('header.roleBusiness.captionRoles')}
                            </p>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                {t('header.roleBusiness.sections.cabinets')}
                            </p>
                        </div>

                        <div className="space-y-1 p-2">
                            {cabinetLinks.map((link) => {
                                const active = matchesCabinet(pathname, link.href);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        role="menuitem"
                                        aria-current={active ? 'page' : undefined}
                                        onClick={handleNavigate}
                                        className={clsx(
                                            'flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                                            active
                                                ? 'bg-[var(--surface-emphasis)] font-semibold text-[var(--text-primary)]'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                                        )}
                                    >
                                        <span>{link.label}</span>
                                        {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : null}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
