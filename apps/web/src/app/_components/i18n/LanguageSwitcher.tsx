'use client';

import { clsx } from 'clsx';

import {useLanguage} from './LanguageProvider';

const LABELS: Record<'ky' | 'ru' | 'en', string> = {
    ky: 'KG',
    ru: 'RU',
    en: 'EN',
};

export function LanguageSwitcher({ onLanguageChange }: { onLanguageChange?: () => void } = {}) {
    const {locale, setLocale} = useLanguage();

    const handleLanguageChange = (code: 'ky' | 'ru' | 'en') => {
        setLocale(code);
        onLanguageChange?.();
    };

    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_78%,transparent)] p-1 text-[11px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)]">
            {(['ky', 'ru', 'en'] as const).map((code) => {
                const active = locale === code;
                return (
                    <button
                        key={code}
                        type="button"
                        onClick={() => handleLanguageChange(code)}
                        className={clsx(
                            'rounded-full px-2.5 py-1 transition-all duration-200',
                            active
                                ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-xs)]'
                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]',
                        )}
                    >
                        {LABELS[code]}
                    </button>
                );
            })}
        </div>
    );
}
