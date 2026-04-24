'use client';

import { clsx } from 'clsx';
import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function StaffCabinetButton({
    onClick,
    className,
}: {
    onClick?: () => void;
    className?: string;
}) {
    const { t } = useLanguage();

    return (
        <Link
            href="/staff"
            onClick={onClick}
            className={clsx(
                'inline-flex items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-md)]',
                className,
            )}
        >
            {t('header.staffCabinet', 'Кабинет сотрудника')}
        </Link>
    );
}

