'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {logError} from '@/lib/log';

type UserRow = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    is_suspended?: boolean | null;
};

type SearchResult = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

export function OwnerForm({
    bizId,
    currentOwners,
}: {
    bizId: string;
    currentOwners: UserRow[];
}) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [owners, setOwners] = useState<UserRow[]>(currentOwners);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Обновляем owners при изменении currentOwners
    useEffect(() => {
        setOwners(currentOwners);
    }, [currentOwners]);

    // Debounce для поиска - только если введено минимум 2 символа
    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            performSearch(trimmed);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    async function performSearch(q: string) {
        setSearchLoading(true);
        try {
            const url = new URL('/admin/api/users/search', window.location.origin);
            if (q) {
                url.searchParams.set('q', q);
            }

            const resp = await fetch(url.toString(), {
                credentials: 'include',
            });

            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }

            const data = await resp.json();
            if (!data.ok) {
                throw new Error(data.error || 'Ошибка поиска');
            }

            setSearchResults(data.items || []);
        } catch (e) {
            logError('OwnerForm', 'Search error', e);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }

    // Фильтруем результаты поиска, исключая уже добавленных владельцев
    const availableOptions = useMemo(() => {
        const ownerIds = new Set(owners.map(o => o.id));
        return searchResults
            .filter(r => !ownerIds.has(r.id))
            .map((u) => {
                const parts: string[] = [];
                if (u.full_name) parts.push(u.full_name);
                if (u.email) parts.push(u.email);
                if (u.phone) parts.push(u.phone);
                const label = parts.length > 0 ? parts.join(' • ') : u.id;
                return {
                    id: u.id,
                    label,
                    full_name: u.full_name,
                    email: u.email,
                    phone: u.phone,
                };
            });
    }, [searchResults, owners]);

    function addOwner(userId: string) {
        const user = searchResults.find(r => r.id === userId);
        if (user && !owners.some(o => o.id === userId)) {
            setOwners([...owners, {
                id: user.id,
                email: user.email,
                phone: user.phone,
                full_name: user.full_name,
            }]);
            setSearchQuery('');
            setSearchResults([]);
        }
    }

    function removeOwner(userId: string) {
        setOwners(owners.filter(o => o.id !== userId));
    }

    const changed = useMemo(() => {
        if (owners.length !== currentOwners.length) return true;
        const currentIds = new Set(currentOwners.map(o => o.id));
        const newIds = new Set(owners.map(o => o.id));
        if (currentIds.size !== newIds.size) return true;
        for (const id of currentIds) {
            if (!newIds.has(id)) return true;
        }
        return false;
    }, [owners, currentOwners]);

    async function save() {
        setErr(null);
        setOk(null);
        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/businesses/${bizId}/owner/save`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_ids: owners.map(o => o.id) }),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data = null;

            if (ct.includes('application/json')) {
                data = await resp.json();
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = { ok: true };
            }

            if (!resp.ok || !data?.ok) {
                throw new Error(data?.error || `HTTP ${resp.status}`);
            }

            setOk(owners.length > 0 ? `Владельцы обновлены (${owners.length})` : 'Все владельцы удалены');
            router.refresh();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    function formatOwnerLabel(owner: UserRow): string {
        const parts: string[] = [];
        if (owner.full_name) parts.push(owner.full_name);
        if (owner.email) parts.push(owner.email);
        if (owner.phone) parts.push(owner.phone);
        return parts.length > 0 ? parts.join(' • ') : owner.id;
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Владельцы бизнеса</h3>
            
            <div className="space-y-4">
                {/* Список текущих владельцев */}
                {owners.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Текущие владельцы ({owners.length})
                        </label>
                        <div className="space-y-2">
                            {owners.map((owner) => (
                                <div
                                    key={owner.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                    <span className="text-sm text-gray-900 dark:text-gray-100">
                                        {formatOwnerLabel(owner)}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeOwner(owner.id)}
                                        disabled={loading}
                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Поиск и добавление нового владельца */}
                <div className="space-y-2">
                    <Input
                        label="Добавить владельца"
                        placeholder="Введите email, телефон или имя (минимум 2 символа)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        helperText={searchQuery.length > 0 && searchQuery.length < 2 ? 'Введите минимум 2 символа для поиска' : 'Начните вводить для поиска пользователя'}
                    />

                    {availableOptions.length > 0 && (
                        <div className="border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 max-h-60 overflow-y-auto">
                            {availableOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => addOwner(option.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {searchLoading && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2">
                            Поиск...
                        </div>
                    )}

                    {!searchLoading && searchQuery.trim().length >= 2 && availableOptions.length === 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2">
                            Ничего не найдено
                        </div>
                    )}
                </div>

                {/* Кнопка сохранения */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={save}
                        disabled={loading || !changed}
                        isLoading={loading}
                    >
                        {loading ? 'Сохраняю…' : 'Сохранить'}
                    </Button>
                    {!changed && <span className="text-xs text-gray-500 dark:text-gray-400">Нет изменений</span>}
                </div>
            </div>

            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                </div>
            )}
            {ok && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium">{ok}</p>
                </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                Используйте поиск для нахождения пользователя. Введите email, телефон или имя. Заблокированные пользователи не могут быть владельцами.
            </div>
        </div>
    );
}
