'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { PersonalCabinetButton } from './PersonalCabinetButton';
import { SignOutButton } from './SignOutButton';
import { StaffCabinetButton } from './StaffCabinetButton';
import { useLanguage } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

import { supabase } from '@/lib/supabaseClient';

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
                        className="fixed inset-0 bg-black/20 z-[45] md:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Меню */}
                    <div className="absolute top-full right-0 mt-2 mr-3 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 z-[60] md:hidden">
                        <div className="p-4 space-y-4">
                            {/* Переключатель языка */}
                            <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                                    {t('header.language', 'Язык')}
                                </div>
                                <LanguageSwitcher onLanguageChange={() => setIsOpen(false)} />
                            </div>

                            {/* Статус авторизации */}
                            <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                                    {t('header.account', 'Аккаунт')}
                                </div>
                                <MobileAuthStatus onAction={() => setIsOpen(false)} />
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
 * Использует те же компоненты, что и десктопная версия
 */
function MobileAuthStatus({ onAction }: { onAction: () => void }) {
    const { t } = useLanguage();
    const [user, setUser] = useState<{ id: string; email?: string; phone?: string } | null>(null);
    const [label, setLabel] = useState<string>('');
    const [isStaff, setIsStaff] = useState(false);

    useEffect(() => {
        let ignore = false;

        (async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (ignore || !authUser) {
                setUser(null);
                return;
            }

            setUser(authUser);

            // Получаем имя из профиля
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', authUser.id)
                .maybeSingle();

            const userName = profile?.full_name?.trim() || authUser.email || (authUser.phone as string | undefined) || 'аккаунт';
            setLabel(userName);

            // Проверяем, является ли пользователь сотрудником
            const { data: staff } = await supabase
                .from('staff')
                .select('id, biz_id')
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .maybeSingle();

            setIsStaff(!!staff);
        })();

        return () => {
            ignore = true;
        };
    }, []);

    if (!user) {
        return (
            <Link 
                href="/auth/sign-in" 
                onClick={onAction}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>{t('header.signIn', 'Войти')}</span>
            </Link>
        );
    }

    return (
        <div className="space-y-2">
            {/* Статус с именем - как в десктопной версии */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300 truncate">
                    <span className="font-medium">{label}</span>
                </span>
            </div>
            
            {/* Кнопки - те же, что в десктопной версии */}
            <div className="flex flex-col gap-2">
                {isStaff && <StaffCabinetButton onClick={onAction} />}
                <PersonalCabinetButton onClick={onAction} />
                <SignOutButton onAction={onAction} />
            </div>
        </div>
    );
}

