'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export type TabItem = {
    key: string;
    label: ReactNode;
    href?: string;
    badge?: ReactNode;
    disabled?: boolean;
};

type TabsProps = {
    items: TabItem[];
    value: string;
    onValueChange?: (value: string) => void;
    size?: 'sm' | 'md';
    stretch?: boolean;
    className?: string;
};

export function Tabs({ items, value, onValueChange, size = 'md', stretch = false, className }: TabsProps) {
    const pathname = usePathname();

    return (
        <div
            role="tablist"
            aria-orientation="horizontal"
            className={clsx(
                'inline-flex w-full max-w-full gap-1 rounded-[var(--radius-lg)] bg-[var(--surface-emphasis)] p-1',
                stretch ? 'flex-wrap' : 'overflow-x-auto',
                className,
            )}
        >
            {items.map((item) => {
                const isActive = item.href ? pathname === item.href || pathname?.startsWith(`${item.href}/`) : item.key === value;
                const sharedClassName = clsx(
                    'motion-interactive inline-flex min-w-fit items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium',
                    size === 'sm' ? 'min-h-[36px] py-2' : 'min-h-[40px] py-2.5',
                    stretch && 'flex-1',
                    item.disabled
                        ? 'cursor-not-allowed opacity-45'
                        : isActive
                          ? 'bg-[var(--surface-card)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                );

                const content = (
                    <>
                        <span>{item.label}</span>
                        {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
                    </>
                );

                if (item.href) {
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={sharedClassName}
                        >
                            {content}
                        </Link>
                    );
                }

                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                            if (!item.disabled) onValueChange?.(item.key);
                        }}
                        disabled={item.disabled}
                        className={sharedClassName}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
}
