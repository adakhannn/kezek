'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';

export type WorkspaceNavItem = {
    href: string;
    label: string;
    icon: ReactNode;
    match?: (pathname: string) => boolean;
    mobilePrimary?: boolean;
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
    moreLabel?: string;
    headerSlot?: ReactNode;
    desktopStorageKey?: string;
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

function WorkspaceTabletRail({ items, pathname, navTitle }: Pick<WorkspaceNavListProps, 'items' | 'pathname'> & { navTitle: string }) {
    return (
        <aside className="hidden w-[184px] shrink-0 self-start md:block lg:hidden" aria-label={navTitle}>
            <div className="sticky top-28 px-2 pb-6">
                <nav className="max-h-[calc(100dvh-8rem)] space-y-1 overflow-y-auto rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] p-2 shadow-[var(--shadow-lg)] backdrop-blur-xl">
                    {items.map((item) => {
                        const active = isItemActive(item, pathname);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                                className={clsx(
                                    'group flex min-h-12 w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                                    active
                                        ? 'border-[color:color-mix(in_srgb,var(--accent-primary)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_16%,var(--surface-card))] text-[var(--accent-primary)] shadow-[var(--shadow-xs)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                                )}
                            >
                                <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
                                <span className="min-w-0 truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}

function WorkspaceMobileBar({
    items,
    pathname,
    moreLabel,
    onOpen,
    isOpen,
}: Pick<WorkspaceNavListProps, 'items' | 'pathname'> & { moreLabel: string; onOpen: () => void; isOpen: boolean }) {
    const configuredPrimaryItems = items.filter((item) => item.mobilePrimary);
    const primaryItems = (configuredPrimaryItems.length > 0 ? configuredPrimaryItems : items).slice(0, 4);
    const primaryHrefs = new Set(primaryItems.map((item) => item.href));
    const secondaryIsActive = items.some((item) => !primaryHrefs.has(item.href) && isItemActive(item, pathname));

    return (
        <nav
            className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[89] grid grid-cols-5 rounded-[24px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_96%,transparent)] p-1.5 shadow-[var(--shadow-xl)] backdrop-blur-xl md:hidden"
            aria-label={moreLabel}
        >
            {primaryItems.map((item) => {
                const active = isItemActive(item, pathname);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                            'flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                            active
                                ? 'bg-[color:color-mix(in_srgb,var(--accent-primary)_16%,var(--surface-card))] text-[var(--accent-primary)]'
                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                        )}
                    >
                        <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
                        <span className="w-full truncate text-center">{item.label}</span>
                    </Link>
                );
            })}
            <button
                type="button"
                onClick={onOpen}
                aria-label={moreLabel}
                aria-expanded={isOpen}
                className={clsx(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                    secondaryIsActive
                        ? 'bg-[color:color-mix(in_srgb,var(--accent-primary)_16%,var(--surface-card))] text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                )}
            >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" />
                </svg>
                <span className="w-full truncate text-center">{moreLabel}</span>
            </button>
        </nav>
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
    moreLabel = openLabel,
    headerSlot,
    desktopStorageKey = 'kezek.workspace.sidebar.collapsed',
}: WorkspaceSidebarShellProps) {
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        try {
            setIsDesktopCollapsed(window.localStorage.getItem(desktopStorageKey) === 'true');
        } catch {
            // Storage can be unavailable in privacy mode. The sidebar still works for this session.
        }
    }, [desktopStorageKey]);

    const setDesktopCollapsed = (collapsed: boolean) => {
        setIsDesktopCollapsed(collapsed);
        try {
            window.localStorage.setItem(desktopStorageKey, String(collapsed));
        } catch {
            // Keep the in-memory state when persistence is unavailable.
        }
    };

    return (
        <>
            <WorkspaceMobileBar items={items} pathname={pathname} moreLabel={moreLabel} onOpen={onOpen} isOpen={isOpen} />

            <WorkspaceTabletRail items={items} pathname={pathname} navTitle={navTitle} />

            {isOpen ? (
                <button
                    type="button"
                    aria-label={closeLabel}
                    className="fixed inset-0 z-[125] bg-black/55 backdrop-blur-[3px] md:hidden"
                    onClick={onClose}
                />
            ) : null}

            <div
                className={clsx(
                    'hidden shrink-0 self-start transition-[width] duration-300 ease-out lg:block',
                    isDesktopCollapsed ? 'w-16' : 'w-[304px]',
                )}
            >
                <div className={clsx('sticky top-28 pb-6', isDesktopCollapsed ? 'px-2' : 'px-4')}>
                    {isDesktopCollapsed ? (
                        <button
                            type="button"
                            onClick={() => setDesktopCollapsed(false)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                            aria-label={openLabel}
                            title={openLabel}
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <WorkspaceSidebarPanel
                            title={title}
                            subtitle={subtitle}
                            badge={badge}
                            items={items}
                            pathname={pathname}
                            navTitle={navTitle}
                            headerSlot={headerSlot}
                            closeButton={
                                <button
                                    type="button"
                                    onClick={() => setDesktopCollapsed(true)}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                    aria-label={closeLabel}
                                    title={closeLabel}
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            }
                        />
                    )}
                </div>
            </div>

            {isOpen ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={navTitle}
                    className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[130] h-[min(44rem,calc(100dvh-1rem))] animate-[workspace-sheet-in_240ms_ease-out] motion-reduce:animate-none md:hidden"
                >
                    <div className="h-full overflow-hidden">
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
                </div>
            ) : null}
        </>
    );
}
