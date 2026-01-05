'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';

type MemberRow = {
    user_id: string;
    email: string | null;
    phone: string | null;
    roles: string[]; // role_key[]
    full_name: string | null;
};

type ListResp = { ok: true; items: MemberRow[] } | { ok: false; error: string };
type MutResp = { ok: true } | { ok: false; error: string };

export type RoleKey = 'owner' | 'admin' | 'manager' | 'staff' | 'client';

const ROLE_COLORS: Record<RoleKey, { bg: string; text: string; border: string }> = {
    owner: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
    admin: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
    manager: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
    staff: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
    client: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' },
};

const ROLE_LABELS: Record<RoleKey, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    staff: 'Сотрудник',
    client: 'Клиент',
};

export default function MembersClient({
    baseURL,
    bizId,
    canManage,
}: {
    baseURL: string;
    bizId: string;
    canManage: boolean;
}) {
    const api = useMemo(() => {
        const root = `${baseURL}/admin/api/businesses/${encodeURIComponent(bizId)}/members`;
        return {
            list: `${root}/list`,
            grant: `${root}/grant`,
            revoke: `${root}/revoke`,
            demote: `${root}/demote`,
        };
    }, [baseURL, bizId]);

    const [items, setItems] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const res = await fetch(api.list, { cache: 'no-store' });
            const j = (await res.json()) as ListResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            setItems(j.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, [api.list]);

    async function grant(user_id: string, role: RoleKey) {
        if (!canManage) return;
        setActionLoading(`${user_id}-grant-${role}`);
        setErr(null);
        try {
            const res = await fetch(api.grant, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setActionLoading(null);
        }
    }

    async function revoke(user_id: string, role: RoleKey) {
        if (!canManage) return;
        setActionLoading(`${user_id}-revoke-${role}`);
        setErr(null);
        try {
            const res = await fetch(api.revoke, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setActionLoading(null);
        }
    }

    async function demote(user_id: string) {
        if (!canManage) return;
        if (!confirm('Убрать участника до «client»? Все другие роли будут сняты.')) return;
        setActionLoading(`${user_id}-demote`);
        setErr(null);
        try {
            const res = await fetch(api.demote, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Загрузка участников...</p>
            </div>
        );
    }

    if (err) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">Ошибка: {err}</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Участников пока нет</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Добавьте первого участника, чтобы начать работу с бизнесом
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((m) => {
                const canAdd = (role: RoleKey) => !m.roles.includes(role);
                const availableRoles = (['owner', 'admin', 'manager', 'staff', 'client'] as RoleKey[]).filter((r) => canAdd(r));
                const isLoading = actionLoading?.startsWith(`${m.user_id}-`) ?? false;

                return (
                    <div
                        key={m.user_id}
                        className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                            {/* Информация о пользователе */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                            {m.full_name || 'Без имени'}
                                        </h3>
                                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-2 break-all">
                                            {m.user_id}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {m.email && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span className="truncate">{m.email}</span>
                                        </div>
                                    )}
                                    {m.phone && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span>{m.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Роли */}
                            <div className="lg:w-80 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Роли
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {m.roles.length > 0 ? (
                                            m.roles.map((r) => {
                                                const role = r as RoleKey;
                                                const colors = ROLE_COLORS[role] || ROLE_COLORS.client;
                                                return (
                                                    <span
                                                        key={r}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                                                    >
                                                        {ROLE_LABELS[role] || role}
                                                        {canManage && (
                                                            <button
                                                                className="opacity-60 hover:opacity-100 transition-opacity"
                                                                onClick={() => revoke(m.user_id, role)}
                                                                disabled={isLoading}
                                                                type="button"
                                                                title="Убрать роль"
                                                                aria-label="Убрать роль"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-sm text-gray-500 dark:text-gray-400">Нет ролей</span>
                                        )}
                                    </div>
                                </div>

                                {canManage && (
                                    <>
                                        {availableRoles.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Добавить роль
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {availableRoles.map((r) => {
                                                        const colors = ROLE_COLORS[r] || ROLE_COLORS.client;
                                                        return (
                                                            <button
                                                                key={r}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${colors.border} ${colors.text} hover:${colors.bg} transition-colors disabled:opacity-50`}
                                                                onClick={() => grant(m.user_id, r)}
                                                                disabled={isLoading}
                                                                type="button"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                </svg>
                                                                {ROLE_LABELS[r] || r}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => demote(m.user_id)}
                                                disabled={isLoading}
                                                className="w-full"
                                            >
                                                {isLoading && actionLoading === `${m.user_id}-demote` ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Обработка...
                                                    </>
                                                ) : (
                                                    'Убрать из участников'
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
