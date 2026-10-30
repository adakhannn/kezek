'use client';

import { useLanguage } from './_components/i18n/LanguageProvider';

export default function RouteLoading() {
    const { t } = useLanguage();

    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-10 text-sm text-[var(--text-secondary)]"
        >
            <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
            />
            <span>{t('common.loading')}</span>
        </div>
    );
}
