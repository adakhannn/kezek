'use client';

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
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200">
            {(['ky', 'ru', 'en'] as const).map((code) => {
                const active = locale === code;
                return (
                    <button
                        key={code}
                        type="button"
                        onClick={() => handleLanguageChange(code)}
                        className={`px-1.5 py-0.5 rounded-full transition ${
                            active
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                    >
                        {LABELS[code]}
                    </button>
                );
            })}
        </div>
    );
}


