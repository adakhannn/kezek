'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignOutButton } from './SignOutButton';
import { useLanguage } from './i18n/LanguageProvider';

import {logDebug, logError, logWarn} from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';


type User = {
    id: string;
    email?: string | null;
    phone?: string | null;
};

type TargetPath = {
    href: string;
    label: string;
    isStaff?: boolean;
};

async function getTargetPath(userId: string, t: (key: string, fallback?: string) => string): Promise<TargetPath> {
    try {
        // Проверяем, является ли пользователь супер-админом
        const { data: isSuperData } = await supabase.rpc('is_super_admin');
        if (isSuperData) {
            return { href: '/admin', label: t('header.adminPanel', 'Админ-панель'), isStaff: false };
        }

        // Проверяем, владеет ли пользователь бизнесом
        const { count } = await supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId);
        if ((count ?? 0) > 0) {
            return { href: '/dashboard', label: t('header.ownerCabinet', 'Кабинет владельца'), isStaff: false };
        }

        // Проверяем, является ли пользователь сотрудником - ищем запись в staff (источник правды)
        let isStaff = false;
        try {
            const { data: staff } = await supabase
                .from('staff')
                .select('id, biz_id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();
            
            isStaff = !!staff;
        } catch (error) {
            logWarn('AuthStatusClient', 'error checking staff record', error);
            // Fallback: проверяем через user_roles
            try {
                const [{ data: ur }, { data: roleRows }] = await Promise.all([
                    supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
                    supabase.from('roles').select('id, key'),
                ]);
                
                if (ur && roleRows) {
                    const rolesMap = new Map<string, string>(roleRows.map(r => [String(r.id), String(r.key)]));
                    const staffRole = ur.find(r => rolesMap.get(String(r.role_id)) === 'staff');
                    isStaff = !!staffRole?.biz_id;
                }
            } catch (fallbackError) {
                logWarn('AuthStatusClient', 'fallback check also failed', fallbackError);
            }
        }
        
        if (isStaff) {
            return { href: '/staff', label: t('header.staffCabinet', 'Кабинет сотрудника'), isStaff: true };
        }
        
        // Проверяем другие роли через RPC
        const { data: roleKeys } = await supabase.rpc('my_role_keys');
        const roles = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
        if (roles.some((r) => ['owner', 'admin', 'manager'].includes(r))) {
            return { href: '/dashboard', label: t('header.businessCabinet', 'Кабинет бизнеса'), isStaff: false };
        }

        // По умолчанию — личный кабинет клиента
        return { href: '/cabinet', label: t('header.myBookings', 'Мои записи'), isStaff: false };
    } catch (error) {
        // В случае ошибки возвращаем кабинет по умолчанию
        logWarn('AuthStatusClient', 'error getting target path', error);
        return { href: '/cabinet', label: t('header.myBookings', 'Мои записи'), isStaff: false };
    }
}

/**
 * Клиентский компонент для отображения статуса авторизации
 * Реагирует на изменения авторизации в реальном времени
 */
export function AuthStatusClient({ onAction }: { onAction?: () => void }) {
    const router = useRouter();
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [target, setTarget] = useState<TargetPath | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        // Функция для обновления статуса
        const updateStatus = async () => {
            try {
                // Сначала проверяем сессию (читает из localStorage/cookies)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (!mounted) return;

                if (sessionError) {
                    logWarn('AuthStatusClient', 'session error', sessionError);
                }

                // Логируем для отладки
                logDebug('AuthStatusClient', 'session check', { 
                    hasSession: !!session, 
                    hasUser: !!session?.user,
                    userId: session?.user?.id 
                });

                if (session?.user) {
                    setUser(session.user);
                    // Определяем путь для редиректа
                    const path = await getTargetPath(session.user.id, t);
                    if (mounted) {
                        setTarget(path);
                    }
                } else {
                    // Если сессии нет, пробуем getUser (может быть в процессе обновления)
                    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
                    
                    logDebug('AuthStatusClient', 'getUser check', { 
                        hasUser: !!currentUser, 
                        userId: currentUser?.id,
                        error: userError 
                    });

                    if (currentUser) {
                        setUser(currentUser);
                        const path = await getTargetPath(currentUser.id, t);
                        if (mounted) {
                            setTarget(path);
                        }
                    } else {
                        setUser(null);
                        setTarget(null);
                    }
                }
            } catch (error) {
                logError('AuthStatusClient', 'error updating status', error);
                if (mounted) {
                    setUser(null);
                    setTarget(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        // Обновляем статус при монтировании
        updateStatus();

        // Подписываемся на изменения авторизации
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            logDebug('AuthStatusClient', 'auth state change', { event, hasSession: !!session, hasUser: !!session?.user });

            if (session?.user) {
                setUser(session.user);
                // Определяем путь для редиректа
                const path = await getTargetPath(session.user.id, t);
                if (mounted) {
                    setTarget(path);
                }
                // Обновляем серверные компоненты
                router.refresh();
            } else {
                // Выход из системы - очищаем состояние
                setUser(null);
                setTarget(null);
                setLoading(false);
                // Обновляем серверные компоненты
                router.refresh();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [router, t]);

    // Получаем имя из профиля
    useEffect(() => {
        if (user) {
            supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle()
                .then(({ data }) => {
                    if (data?.full_name) {
                        setProfileName(data.full_name);
                    } else {
                        setProfileName(null);
                    }
                });
        } else {
            setProfileName(null);
        }
    }, [user]);

    // Показываем кнопку "Войти" если не авторизован
    // На мобильных это будет в мобильном меню, на десктопе - в хедере
    if (!user || loading) {
        return (
            <div className="w-full">
                <Link 
                    href="/auth/sign-in" 
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>{t('header.signIn', 'Войти')}</span>
                </Link>
            </div>
        );
    }
    
    const label = profileName || user.email || (user.phone as string | undefined) || t('header.account', 'аккаунт');

    // Если путь еще не определен, показываем загрузку
    if (!target) {
        return (
            <div className="w-full">
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm animate-pulse text-center">
                    {t('header.loading', 'Загрузка...')}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-stretch gap-2 w-full">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300 truncate">
                    <span className="font-medium">{label}</span>
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {target.isStaff && (
                    <Link 
                        href="/staff" 
                        onClick={onAction}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>{t('header.staffCabinet', 'Кабинет сотрудника')}</span>
                    </Link>
                )}
                <Link 
                    href={target.href}
                    onClick={onAction}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{target.label}</span>
                </Link>
                <SignOutButton onAction={onAction} />
            </div>
        </div>
    );
}

