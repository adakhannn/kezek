'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {logDebug, logError, logWarn} from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

export default function PostSignup() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        let mounted = true;
        
        (async () => {
            setLoading(true);
            
            try {
                // Проверяем, авторизован ли пользователь
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                
                if (userError || !user) {
                    logWarn('PostSignup', 'User not authenticated', userError);
                    if (mounted) {
                        router.replace('/auth/sign-in');
                    }
                    return;
                }

                // Загружаем текущий профиль
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('full_name, phone')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profileError) {
                    logError('PostSignup', 'Error loading profile', profileError);
                }

                if (!mounted) return;

                // Заполняем поля из localStorage или профиля
                const storedName = localStorage.getItem('signup_full_name');
                const storedPhone = localStorage.getItem('signup_phone');
                
                setFullName(profile?.full_name || storedName || user.user_metadata?.full_name || '');
                setPhone(profile?.phone || storedPhone || '');

                // Если имя уже есть в профиле, можно сразу завершить (телефон не обязателен)
                if (profile?.full_name?.trim()) {
                    localStorage.removeItem('signup_full_name');
                    localStorage.removeItem('signup_phone');
                    // Небольшая задержка для обновления данных
                    setTimeout(() => {
                        if (mounted) {
                            router.replace('/');
                        }
                    }, 500);
                }
            } catch (error) {
                logError('PostSignup', 'Error in useEffect', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        })();
        
        return () => {
            mounted = false;
        };
    }, [router]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        
        // Проверяем, что имя заполнено
        if (!fullName.trim()) {
            setError('Пожалуйста, введите ваше имя');
            return;
        }
        
        setSaving(true);
        setMessage(null);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Не авторизован');
            }

            logDebug('PostSignup', 'Saving profile', { fullName: fullName.trim() });

            // Обновляем профиль
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName.trim() || null,
                    // phone больше не требуется, но оставляем для совместимости
                }),
            });

            logDebug('PostSignup', 'Response status', { status: res.status });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Ошибка при сохранении' }));
                throw new Error(errorData.message || errorData.error || 'Ошибка при сохранении');
            }

            const data = await res.json();
            logDebug('PostSignup', 'Response data', data);
            
            if (!data.ok) {
                throw new Error(data.message || data.error || 'Ошибка при сохранении');
            }

            // Очищаем localStorage
            localStorage.removeItem('signup_full_name');
            localStorage.removeItem('signup_phone');

            setMessage('Профиль сохранен');
            
            // Обновляем страницу, чтобы middleware увидел новое имя, затем редиректим
            router.refresh();
            
            // Небольшая задержка для обновления данных на сервере
            setTimeout(() => {
                // Используем window.location для гарантированного редиректа
                window.location.href = '/';
            }, 500);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('PostSignup', 'Error saving profile', e);
            setError(msg);
            setSaving(false); // Убеждаемся, что состояние сбрасывается при ошибке
        } finally {
            // Дополнительная проверка - сбрасываем состояние через таймаут на случай, если что-то пошло не так
            setTimeout(() => {
                setSaving(false);
            }, 10000); // Максимум 10 секунд
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <div className="text-sm text-gray-600">Загрузка...</div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-indigo-950 dark:via-gray-900 dark:to-pink-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Завершение регистрации</h1>
                    <p className="text-gray-600 dark:text-gray-400">Укажите ваше имя для завершения регистрации</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Имя <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ваше имя"
                        />
                    </div>
                    {message && (
                        <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:border-green-900/60 dark:text-green-100">
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-100">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={saving || !fullName.trim()}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Сохранение...' : 'Завершить регистрацию'}
                    </button>
                </form>
            </div>
        </main>
    );
}
