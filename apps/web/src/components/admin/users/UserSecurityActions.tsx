'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type OkResp = { ok: true };
type ErrResp = { ok: false; error?: string; message?: string; code?: string; businesses?: { id: string; name: string | null; slug: string | null }[] };
type ToggleSuperResp = OkResp | ErrResp;
type DeleteUserResp = OkResp | ErrResp;
type SendMagicResp = ({ ok: true; link?: string } | ErrResp);
type SuspendResp = { ok: true; blocked: boolean } | ErrResp;

export function UserSecurityActions({ userId, isSuper, isBlocked }: { userId: string; isSuper: boolean; isBlocked: boolean }) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [superVal, setSuperVal] = useState(isSuper);
    const [blocked, setBlocked] = useState(isBlocked);
    const [magic, setMagic] = useState<string | null>(null);
    const router = useRouter();

    const extractError = (e: unknown) => (e instanceof Error ? e.message : String(e));

    async function sendMagic() {
        setLoading(true);
        setErr(null);
        setMsg(null);
        setMagic(null);
        try {
            const resp = await fetch(`/admin/api/users/${userId}/send-magic-link`, { method: 'POST' });
            const j = (await resp.json()) as SendMagicResp;
            if (!resp.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${resp.status}`);
            setMsg('Magic-link отправлен на email (если настроена почта)');
            if ('link' in j && j.link) setMagic(j.link);
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    async function toggleSuper(next: boolean) {
        setLoading(true);
        setErr(null);
        setMsg(null);
        try {
            const resp = await fetch(`/admin/api/users/${userId}/toggle-super`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ makeSuper: next }),
            });
            const j = (await resp.json()) as ToggleSuperResp;
            if (!resp.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${resp.status}`);
            setSuperVal(next);
            setMsg(next ? 'Назначен супер-админом' : 'Супер-админ снят');
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    async function callSuspend(next: boolean) {
        setLoading(true); setErr(null); setMsg(null);
        try {
            const resp = await fetch(`/admin/api/users/${userId}/suspend`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ block: next }),
            });
            const j = (await resp.json()) as SuspendResp;
            if (!resp.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || ('message' in j && j.message) || `HTTP ${resp.status}`);
            setBlocked(j.blocked);
            setMsg(j.blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
            router.refresh();
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    async function deleteUser() {
        if (!confirm('Удалить пользователя? Это действие необратимо.')) return;
        setLoading(true);
        setErr(null);
        setMsg(null);
        
        try {
            const resp = await fetch(`/admin/api/users/${userId}/delete`, { method: 'POST' });
            const j = (await resp.json()) as DeleteUserResp;

            if (!resp.ok) {
                // маппинг загадочной ошибки удаления -> совет на блокировку
                if (resp.status === 409 && 'code' in j && j.code === 'DELETE_BLOCKED_USE_SUSPEND') {
                    const list = Array.isArray(j.businesses)
                        ? j.businesses.map((b) => (b.slug ? `${b.name} (@${b.slug})` : (b.name ?? 'Без названия'))).join(', ')
                        : '';
                    setErr('Удаление не доступно. Используйте «Заблокировать» выше.' + (list ? ` Бизнесы: ${list}` : ''));
                    setLoading(false);
                    return;
                }
                setErr(('error' in j && j.error) || ('message' in j && j.message) || `HTTP ${resp.status}`);
                setMsg('Можно вместо удаления заблокировать пользователя (кнопка ниже).');
                setLoading(false);
                return;
            }

            // УСПЕШНОЕ удаление - немедленный редирект БЕЗ задержек
            // Используем replace вместо href, чтобы не добавлять в историю
            // И делаем это СРАЗУ, до любых других операций
            window.location.replace('/admin/users');
            // Не выполняем код после этой строки - редирект уже начался
            return;
        } catch (e) {
            setErr(extractError(e));
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Безопасность
                </h3>

                <div className="space-y-3">
                    <button
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                        onClick={sendMagic}
                        type="button"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Отправка...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Отправить Magic-link
                            </>
                        )}
                    </button>
                    {magic && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <p className="text-xs text-indigo-800 dark:text-indigo-300 font-medium mb-1">Ссылка для входа:</p>
                            <p className="text-xs break-all text-indigo-600 dark:text-indigo-400">{magic}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Супер-админ</label>
                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={superVal}
                                onChange={(e) => toggleSuper(e.target.checked)}
                                disabled={loading}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                {superVal ? 'Да' : 'Нет'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Статус блокировки</label>
                    <div className="flex items-center gap-2 mb-3">
                        {blocked ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                                Заблокирован
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Активен
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || blocked}
                            onClick={() => callSuspend(true)}
                            type="button"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Заблокировать
                        </button>
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || !blocked}
                            onClick={() => callSuspend(false)}
                            type="button"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Разблокировать
                        </button>
                    </div>
                </div>

                {msg && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-800 dark:text-green-300">{msg}</p>
                    </div>
                )}
                {err && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-300">{err}</p>
                    </div>
                )}
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                        <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Опасная зона</h3>
                        <p className="text-sm text-red-800 dark:text-red-400">
                            Удаление полностью удалит аккаунт. Если удаление не проходит — используйте «Заблокировать» выше.
                        </p>
                    </div>
                </div>
                <button
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                    onClick={deleteUser}
                    type="button"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Удаление...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Удалить пользователя
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
