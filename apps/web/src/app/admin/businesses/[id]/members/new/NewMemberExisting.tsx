'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type UserMini = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type SearchResp = { ok: true; items: UserMini[] } | { ok: false; error: string };
type MutResp = { ok: true } | { ok: false; error: string };

const ELEVATED = ['owner', 'admin', 'manager', 'staff'] as const;
type ElevatedRole = typeof ELEVATED[number];

const ROLE_LABELS: Record<ElevatedRole, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    staff: 'Сотрудник',
};

const ROLE_COLORS: Record<ElevatedRole, string> = {
    owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    manager: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    staff: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
};

export default function NewMemberExisting({ baseURL, bizId }: { baseURL: string; bizId: string }) {
    const router = useRouter();
    const api = useMemo(() => {
        return {
            search: `${baseURL}/admin/api/users/search`,
            grant: `${baseURL}/admin/api/businesses/${encodeURIComponent(bizId)}/members/grant`,
        };
    }, [baseURL, bizId]);

    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [list, setList] = useState<UserMini[]>([]);
    const [role, setRole] = useState<ElevatedRole>('staff');
    const [granting, setGranting] = useState<string | null>(null);

    const searchUsers = useCallback(async (searchQuery: string = q) => {
        setLoading(true);
        setErr(null);
        try {
            const url = new URL(api.search);
            if (searchQuery.trim()) url.searchParams.set('q', searchQuery.trim());
            const res = await fetch(url.toString(), { cache: 'no-store' });
            const j = (await res.json()) as SearchResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            setList(j.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [api.search]);

    // Debounce для поиска
    useEffect(() => {
        const timer = setTimeout(() => {
            void searchUsers(q);
        }, 300);

        return () => clearTimeout(timer);
    }, [q, searchUsers]);

    // Загружаем первые результаты при монтировании
    useEffect(() => {
        void searchUsers('');
    }, [searchUsers]);

    async function grant(userId: string) {
        setGranting(userId);
        setErr(null);
        setSuccess(null);
        try {
            const res = await fetch(api.grant, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ user_id: userId, role_key: role }),
            });
            const j = (await res.json()) as MutResp;
            if (!res.ok || !('ok' in j) || !j.ok) throw new Error(('error' in j && j.error) || `HTTP ${res.status}`);
            setSuccess(`Роль "${ROLE_LABELS[role]}" успешно выдана пользователю`);
            // Обновляем список
            await searchUsers(q);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setGranting(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                label="Поиск пользователя"
                                placeholder="Введите email, телефон или имя"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                helperText="Начните вводить для поиска пользователя в системе"
                            />
                        </div>
                        <div className="sm:w-48">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Роль
                            </label>
                            <select
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm"
                                value={role}
                                onChange={(e) => setRole(e.target.value as ElevatedRole)}
                            >
                                {ELEVATED.map((r) => (
                                    <option key={r} value={r}>
                                        {ROLE_LABELS[r]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium">{err}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm text-green-800 dark:text-green-300 font-medium">{success}</p>
                </div>
            )}

            {loading && list.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Поиск пользователей...</p>
                </div>
            ) : list.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Ничего не найдено</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {q.trim() ? 'Попробуйте изменить запрос поиска' : 'Начните вводить для поиска пользователя'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {list.map((u) => {
                        const isGranting = granting === u.id;
                        return (
                            <div
                                key={u.id}
                                className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                            {u.full_name || 'Без имени'}
                                        </h3>
                                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-3 break-all">
                                            {u.id}
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            {u.email && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="truncate">{u.email}</span>
                                                </div>
                                            )}
                                            {u.phone && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <span>{u.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
                                            {ROLE_LABELS[role]}
                                        </div>
                                        <Button
                                            onClick={() => grant(u.id)}
                                            disabled={isGranting}
                                            isLoading={isGranting}
                                            size="sm"
                                        >
                                            {isGranting ? 'Выдаю...' : 'Выдать роль'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
