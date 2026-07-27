'use client';

import { clsx } from 'clsx';
import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function PersonalCabinetButton({
    onClick,
    className,
}: {
    onClick?: () => void;
    className?: string;
}) {
    const { t } = useLanguage();

    return (
        <Link 
            href="/cabinet" 
            onClick={onClick}
            className={clsx(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:border-[var(--accent-primary)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--accent-primary)] hover:shadow-[var(--shadow-sm)]',
                className,
            )}
        >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('header.personalCabinet', 'Личный кабинет')}
        </Link>
    );
}

