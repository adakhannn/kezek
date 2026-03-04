'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { PREFERRED_CABINET_COOKIE_NAME, pathToPreferredCabinet } from '@/lib/authContext';

const COOKIE_MAX_AGE_YEAR = 365 * 24 * 60 * 60;

export type CabinetOption = {
    path: string;
    labelKey: string;
    defaultLabel: string;
};

type Props = {
    options: CabinetOption[];
};

function setPreferredCabinetCookie(value: string) {
    if (typeof document === 'undefined') return;
    document.cookie = `${PREFERRED_CABINET_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_YEAR}; SameSite=Lax`;
}

export function SelectCabinetClient({ options }: Props) {
    const { t } = useLanguage();
    const router = useRouter();
    const [rememberChoice, setRememberChoice] = useState(true);

    const handleSelect = (path: string) => {
        if (rememberChoice) {
            const preferred = pathToPreferredCabinet(path);
            if (preferred) setPreferredCabinetCookie(preferred);
        }
        router.push(path);
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/60 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-lg">
                <div className="mb-6 text-center">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-50">
                        {t('selectCabinet.title', 'Как вы хотите зайти?')}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t('selectCabinet.subtitle', 'У вас есть доступ к нескольким кабинетам.')}
                    </p>
                </div>

                <div className="space-y-2">
                    {options.map(({ path, labelKey, defaultLabel }) => (
                        <button
                            key={path}
                            type="button"
                            onClick={() => handleSelect(path)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
                        >
                            <span className="text-sm font-medium">{t(labelKey, defaultLabel)}</span>
                        </button>
                    ))}
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                        type="checkbox"
                        checked={rememberChoice}
                        onChange={(e) => setRememberChoice(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {t('selectCabinet.rememberChoice', 'Запомнить выбор и в следующий раз заходить сюда')}
                </label>
            </div>
        </main>
    );
}
