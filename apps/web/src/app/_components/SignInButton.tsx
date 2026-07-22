'use client';

import Link from 'next/link';
import type { MouseEventHandler } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

/**
 * Клиентский компонент кнопки "Войти" с поддержкой переводов
 */
export function SignInButton({
    className,
    onClick,
}: {
    className?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
    const { t } = useLanguage();

    return (
        <Link 
            href="/auth/sign-in" 
            onClick={onClick}
            className={className ?? "px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"}
        >
            {t('header.signIn', 'Войти')}
        </Link>
    );
}

