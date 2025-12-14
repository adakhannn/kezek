'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignOutButton } from './SignOutButton';

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

async function getTargetPath(userId: string): Promise<TargetPath> {
    try {
        // Проверяем, является ли пользователь супер-админом
        const { data: isSuperData } = await supabase.rpc('is_super_admin');
        if (isSuperData) {
            return { href: '/admin', label: 'Админ-панель', isStaff: false };
        }

        // Проверяем, владеет ли пользователь бизнесом
        const { count } = await supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId);
        if ((count ?? 0) > 0) {
            return { href: '/dashboard', label: 'Кабинет владельца', isStaff: false };
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
            console.warn('AuthStatusClient: error checking staff record', error);
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
                console.warn('AuthStatusClient: fallback check also failed', fallbackError);
            }
        }
        
        if (isStaff) {
            return { href: '/staff', label: 'Кабинет сотрудника', isStaff: true };
        }
        
        // Проверяем другие роли через RPC
        const { data: roleKeys } = await supabase.rpc('my_role_keys');
        const roles = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
        if (roles.some((r) => ['owner', 'admin', 'manager'].includes(r))) {
            return { href: '/dashboard', label: 'Кабинет бизнеса', isStaff: false };
        }

        // По умолчанию — личный кабинет клиента
        return { href: '/cabinet', label: 'Мои записи', isStaff: false };
    } catch (error) {
        // В случае ошибки возвращаем кабинет по умолчанию
        console.warn('AuthStatusClient: error getting target path', error);
        return { href: '/cabinet', label: 'Мои записи', isStaff: false };
    }
}

/**
 * Клиентский компонент для отображения статуса авторизации
 * Реагирует на изменения авторизации в реальном времени
 */
export function AuthStatusClient() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [target, setTarget] = useState<TargetPath | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Функция для обновления статуса
        const updateStatus = async () => {
            try {
                // Сначала проверяем сессию (читает из localStorage/cookies)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (!mounted) return;

                if (sessionError) {
                    console.warn('AuthStatusClient: session error', sessionError);
                }

                // Логируем для отладки
                if (process.env.NODE_ENV === 'development') {
                    console.log('AuthStatusClient: session check', { 
                        hasSession: !!session, 
                        hasUser: !!session?.user,
                        userId: session?.user?.id 
                    });
                }

                if (session?.user) {
                    setUser(session.user);
                    // Определяем путь для редиректа
                    const path = await getTargetPath(session.user.id);
                    if (mounted) {
                        setTarget(path);
                    }
                } else {
                    // Если сессии нет, пробуем getUser (может быть в процессе обновления)
                    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
                    
                    if (process.env.NODE_ENV === 'development') {
                        console.log('AuthStatusClient: getUser check', { 
                            hasUser: !!currentUser, 
                            userId: currentUser?.id,
                            error: userError 
                        });
                    }

                    if (currentUser) {
                        setUser(currentUser);
                        const path = await getTargetPath(currentUser.id);
                        if (mounted) {
                            setTarget(path);
                        }
                    } else {
                        setUser(null);
                        setTarget(null);
                    }
                }
            } catch (error) {
                console.error('AuthStatusClient: error updating status', error);
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

            if (process.env.NODE_ENV === 'development') {
                console.log('AuthStatusClient: auth state change', { event, hasSession: !!session, hasUser: !!session?.user });
            }

            if (session?.user) {
                setUser(session.user);
                // Определяем путь для редиректа
                const path = await getTargetPath(session.user.id);
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
    }, [router]);

    // Показываем кнопку "Войти" если не авторизован
    if (!user || loading) {
        return (
            <div className="flex items-center gap-3">
                <Link 
                    href="/auth/sign-in" 
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                >
                    Войти
                </Link>
            </div>
        );
    }

    const label = user.email ?? user.phone ?? 'аккаунт';

    // Если путь еще не определен, показываем загрузку
    if (!target) {
        return (
            <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm animate-pulse">
                    Загрузка...
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{label}</span>
                </span>
            </div>
            {target.isStaff && (
                <Link 
                    href="/staff" 
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                >
                    Кабинет сотрудника
                </Link>
            )}
            <Link 
                href="/cabinet" 
                className="px-4 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 text-sm"
            >
                Мои записи
            </Link>
            <SignOutButton />
        </div>
    );
}

