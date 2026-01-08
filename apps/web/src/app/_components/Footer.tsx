'use client';

import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function Footer() {
    const { t } = useLanguage();
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
            <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-3 sm:gap-4">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center md:text-left">
                        © {year} Kezek. {t('footer.rights', 'Все права защищены.')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-4 gap-y-2">
                        <Link
                            href="/privacy"
                            className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.privacy', 'Политика конфиденциальности')}
                        </Link>
                        <Link
                            href="/terms"
                            className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.terms', 'Пользовательское соглашение')}
                        </Link>
                        <Link
                            href="/data-deletion"
                            className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.dataDeletion', 'Удаление данных')}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}


