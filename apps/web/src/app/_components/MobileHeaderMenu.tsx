'use client';

import { useState } from 'react';

import { AuthStatusClient } from './AuthStatusClient';
import { useLanguage } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

/**
 * Мобильное меню для хедера
 * Показывает гамбургер на мобильных и выпадающее меню
 */
export function MobileHeaderMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();

    return (
        <>
            {/* Кнопка гамбургера для мобильных */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
                aria-label="Меню"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ width: '24px', height: '24px' }}
                >
                    {isOpen ? (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    )}
                </svg>
            </button>

            {/* Выпадающее меню */}
            {isOpen && (
                <>
                    {/* Overlay для закрытия меню */}
                    <div
                        className="fixed inset-0 bg-black/20 z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Меню */}
                    <div className="absolute top-full right-0 mt-2 mr-3 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 z-50 md:hidden">
                        <div className="p-4 space-y-4">
                            {/* Переключатель языка */}
                            <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                                    {t('header.language', 'Язык')}
                                </div>
                                <LanguageSwitcher />
                            </div>

                            {/* Статус авторизации */}
                            <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                                    {t('header.account', 'Аккаунт')}
                                </div>
                                <MobileAuthStatus />
                            </div>
                        </div>
                    </div>
                </>
            )}

        </>
    );
}

/**
 * Упрощенная версия AuthStatus для мобильного меню
 */
function MobileAuthStatus() {
    return (
        <div className="space-y-2">
            <AuthStatusClient />
        </div>
    );
}

