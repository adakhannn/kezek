'use client';

import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function Footer() {
    const { t } = useLanguage();
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        © {year} Kezek. {t('footer.rights', 'Все права защищены.')}
                    </p>
                    <div className="flex items-center gap-6 flex-wrap">
                        <Link
                            href="/privacy"
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.privacy', 'Политика конфиденциальности')}
                        </Link>
                        <Link
                            href="/terms"
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.terms', 'Пользовательское соглашение')}
                        </Link>
                        <Link
                            href="/data-deletion"
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {t('footer.dataDeletion', 'Удаление данных')}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}


