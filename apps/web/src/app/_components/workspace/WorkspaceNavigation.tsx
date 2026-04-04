'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { ReactNode, useEffect } from 'react';

export type WorkspaceNavItem = {
    href: string;
    label: string;
    icon: ReactNode;
    match?: (pathname: string) => boolean;
};

type WorkspaceNavListProps = {
    items: WorkspaceNavItem[];
    pathname: string;
    onNavigate?: () => void;
};

type WorkspaceSidebarShellProps = {
    title: string;
    subtitle: string;
    badge?: string;
    items: WorkspaceNavItem[];
    pathname: string;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    openLabel: string;
    closeLabel: string;
    navTitle: string;
    headerSlot?: ReactNode;
};

function isItemActive(item: WorkspaceNavItem, pathname: string) {
    if (item.match) {
        return item.match(pathname);
    }

    return pathname === item.href || (item.href !== '/dashboard' && item.href !== '/staff' && pathname.startsWith(item.href));
}

export function WorkspaceNavList({
    items,
    pathname,
    onNavigate,
}: WorkspaceNavListProps) {
    return (
        <nav className="space-y-1.5">
            {items.map((item) => {
                const active = isItemActive(item, pathname);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={onNavigate}
                        className={clsx(
                            'group flex items-center gap-3 rounded-[var(--radius-lg)] px-3.5 py-3 text-sm font-medium transition-all duration-200',
                            active
                                ? 'bg-[color:color-mix(in_srgb,var(--accent-primary)_14%,var(--surface-card))] text-[var(--accent-primary)] shadow-[var(--shadow-xs)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                        )}
                    >
                        <span
                            className={clsx(
                                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                                active
                                    ? 'border-[color:color-mix(in_srgb,var(--accent-primary)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] group-hover:border-[var(--border-default)]',
                            )}
                        >
                            {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

function WorkspaceSidebarPanel({
    title,
    subtitle,
    badge,
    items,
    pathname,
    navTitle,
    headerSlot,
    onNavigate,
    closeButton,
}: {
    title: string;
    subtitle: string;
    badge?: string;
    items: WorkspaceNavItem[];
    pathname: string;
    navTitle: string;
    headerSlot?: ReactNode;
    onNavigate?: () => void;
    closeButton?: ReactNode;
}) {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] shadow-[var(--shadow-xl)] backdrop-blur-xl">
            <div className="border-b border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_30%)] px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {badge ? (
                            <p className="type-caption mb-2 inline-flex rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_86%,transparent)] px-2.5 py-1 text-[var(--text-muted)]">
                                {badge}
                            </p>
                        ) : null}
                        <h2 className="type-section-title text-[var(--text-primary)]">{title}</h2>
                        <p className="type-caption mt-1 text-[var(--text-muted)]">{subtitle}</p>
                    </div>
                    {closeButton}
                </div>
                {headerSlot ? <div className="mt-4">{headerSlot}</div> : null}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                <div className="mb-3 px-1">
                    <p className="type-caption text-[var(--text-muted)]">{navTitle}</p>
                </div>
                <WorkspaceNavList items={items} pathname={pathname} onNavigate={onNavigate} />
            </div>
        </div>
    );
}

export function WorkspaceSidebarShell({
    title,
    subtitle,
    badge,
    items,
    pathname,
    isOpen,
    onOpen,
    onClose,
    openLabel,
    closeLabel,
    navTitle,
    headerSlot,
}: WorkspaceSidebarShellProps) {
    useEffect(() => {
        if (!isOpen) return;

        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            <button
                type="button"
                onClick={onOpen}
                className={clsx(
                    'lg:hidden fixed left-4 top-24 z-[92] inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                    isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100',
                )}
                aria-label={openLabel}
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" />
                </svg>
            </button>

            {isOpen ? (
                <button
                    type="button"
                    aria-hidden="true"
                    className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px] lg:hidden"
                    onClick={onClose}
                />
            ) : null}

            <div className="hidden lg:block w-[304px] shrink-0 self-start">
                <div className="sticky top-28 px-4 pb-6">
                    <WorkspaceSidebarPanel
                        title={title}
                        subtitle={subtitle}
                        badge={badge}
                        items={items}
                        pathname={pathname}
                        navTitle={navTitle}
                        headerSlot={headerSlot}
                    />
                </div>
            </div>

            <div
                className={clsx(
                    'fixed inset-y-0 left-0 z-[95] w-full max-w-[21rem] p-3 transition-transform duration-300 ease-out lg:hidden',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <WorkspaceSidebarPanel
                    title={title}
                    subtitle={subtitle}
                    badge={badge}
                    items={items}
                    pathname={pathname}
                    navTitle={navTitle}
                    headerSlot={headerSlot}
                    onNavigate={onClose}
                    closeButton={
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                            aria-label={closeLabel}
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    }
                />
            </div>
        </>
    );
}
