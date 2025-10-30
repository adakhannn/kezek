'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type OkResp = { ok: true };
type ErrResp = { ok: false; error?: string; message?: string; code?: string; businesses?: { id: string; name: string | null; slug: string | null }[] };
type SetPasswordResp = OkResp | ErrResp;
type ToggleSuperResp = OkResp | ErrResp;
type DeleteUserResp = OkResp | ErrResp;
type SendMagicResp = ({ ok: true; link?: string } | ErrResp);
type SuspendResp = { ok: true; blocked: boolean } | ErrResp;

export function UserSecurityActions({ userId, isSuper, isBlocked }: { userId: string; isSuper: boolean; isBlocked: boolean }) {
    const [pwd, setPwd] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [superVal, setSuperVal] = useState(isSuper);
    const [blocked, setBlocked] = useState(isBlocked);
    const [magic, setMagic] = useState<string | null>(null);
    const router = useRouter();

    const extractError = (e: unknown) => (e instanceof Error ? e.message : String(e));

    async function setPassword() {
        setLoading(true);
        setErr(null);
        setMsg(null);
        try {
            const resp = await fetch(`/admin/api/users/${userId}/set-password`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ password: pwd }),
            });
            const j = (await resp.json()) as SetPasswordResp;
            if (!resp.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${resp.status}`);
            setMsg('Пароль обновлён');
            setPwd('');
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

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
                    return;
                }
                setErr(('error' in j && j.error) || ('message' in j && j.message) || `HTTP ${resp.status}`);
                setMsg('Можно вместо удаления заблокировать пользователя (кнопка ниже).');
                return;
            }

            router.push('/admin/users');
            router.refresh();
        } catch (e) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4 rounded border p-4">
                <h3 className="font-semibold">Безопасность</h3>

                <div className="space-y-2">
                    <label className="text-sm">Новый пароль</label>
                    <input
                        type="password"
                        className="border rounded px-3 py-2 w-full"
                        value={pwd}
                        onChange={(e) => setPwd(e.target.value)}
                    />
                    <button
                        className="border rounded px-3 py-2"
                        disabled={loading || pwd.length < 8}
                        onClick={setPassword}
                        type="button"
                    >
                        Установить пароль
                    </button>
                </div>

                <div className="space-y-2">
                    <button
                        className="border rounded px-3 py-2"
                        disabled={loading}
                        onClick={sendMagic}
                        type="button"
                    >
                        Отправить Magic-link
                    </button>
                    {magic && <div className="text-xs break-all text-gray-600">Ссылка: {magic}</div>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm">Супер-админ</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={superVal}
                            onChange={(e) => toggleSuper(e.target.checked)}
                        />
                        <span className="text-sm">{superVal ? 'Да' : 'Нет'}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm">Статус</label>
                    <div className="text-sm">{blocked ? 'Заблокирован' : 'Активен'}</div>
                    <div className="flex gap-2">
                        <button
                            className="border rounded px-3 py-2"
                            disabled={loading || blocked}
                            onClick={() => callSuspend(true)}
                            type="button"
                        >
                            Заблокировать
                        </button>
                        <button
                            className="border rounded px-3 py-2"
                            disabled={loading || !blocked}
                            onClick={() => callSuspend(false)}
                            type="button"
                        >
                            Разблокировать
                        </button>
                    </div>
                </div>

                {msg && <div className="text-green-600 text-sm">{msg}</div>}
                {err && <div className="text-red-600 text-sm">{err}</div>}
            </div>

            <div className="space-y-2 rounded border border-red-300 p-4">
                <h3 className="font-semibold text-red-700">Опасная зона</h3>
                <p className="text-sm text-red-700/80">
                    Удаление полностью удалит аккаунт. Если удаление не проходит — используйте «Заблокировать» выше.
                </p>
                <button
                    className="border border-red-600 text-red-700 hover:bg-red-50 rounded px-3 py-2"
                    disabled={loading}
                    onClick={deleteUser}
                    type="button"
                >
                    Удалить пользователя
                </button>
            </div>
        </div>
    );
}
