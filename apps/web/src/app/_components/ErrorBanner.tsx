'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type ErrorBannerVariant = 'auth' | 'validation' | 'internal' | 'info';

export interface ErrorBannerProps {
    variant?: ErrorBannerVariant;
    title: string;
    message?: string;
    details?: ReactNode;
    onRetry?: () => void;
}

export function ErrorBanner({
    variant = 'internal',
    title,
    message,
    details,
    onRetry,
}: ErrorBannerProps) {
    const { t } = useLanguage();

    const colorsByVariant: Record<ErrorBannerVariant, string> = {
        auth: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100',
        validation:
            'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-100',
        internal:
            'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-100',
        info: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-100',
    };

    const icon =
        variant === 'info' ? (
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        );

    return (
        <div
            className={`rounded-lg border px-4 py-3 sm:px-5 sm:py-4 shadow-sm flex gap-3 sm:gap-4 ${colorsByVariant[variant]}`}
        >
            <div className="mt-0.5 flex-shrink-0">{icon}</div>
            <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">{title}</p>
                {message && <p className="text-sm opacity-90">{message}</p>}
                {details && <div className="text-xs sm:text-sm opacity-90">{details}</div>}

                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-current px-3 py-1 text-xs font-medium hover:bg-white/10"
                    >
                        {t('error.action.retry', 'Попробовать ещё раз')}
                    </button>
                )}
            </div>
        </div>
    );
}

