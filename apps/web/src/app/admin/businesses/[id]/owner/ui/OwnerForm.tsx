'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
    currentOwnerId,
    currentOwner,
}: {
    bizId: string;
    currentOwnerId: string | null;
    currentOwner?: UserRow | null;
}) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selected, setSelected] = useState<string>(currentOwnerId ?? '');
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Debounce для поиска
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2 || searchQuery.trim().length === 0) {
                performSearch(searchQuery.trim());
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Загружаем первые результаты при монтировании
    useEffect(() => {
        performSearch('');
    }, []);

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
            console.error('Search error:', e);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }

    // Объединяем результаты поиска с текущим владельцем
    const options = useMemo(() => {
        const results = [...searchResults];
        
        // Добавляем текущего владельца, если он есть и его нет в результатах
        if (currentOwner && currentOwnerId) {
            const exists = results.some((r) => r.id === currentOwnerId);
            if (!exists) {
                results.unshift({
                    id: currentOwner.id,
                    email: currentOwner.email,
                    phone: currentOwner.phone,
                    full_name: currentOwner.full_name,
                });
            }
        }

        return results.map((u) => {
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
    }, [searchResults, currentOwner, currentOwnerId]);

    const changed = (selected || '') !== (currentOwnerId || '');

    async function save() {
        setErr(null);
        setOk(null);
        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/businesses/${bizId}/owner/save`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: selected || null }),
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

            setOk(selected ? 'Владелец назначен' : 'Владелец снят');
            router.refresh();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Владелец бизнеса</h3>
            
            <div className="space-y-4">
                <div>
                    <Input
                        label="Поиск пользователя"
                        placeholder="Введите email, телефон или имя (минимум 2 символа)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        helperText={searchQuery.length > 0 && searchQuery.length < 2 ? 'Введите минимум 2 символа для поиска' : 'Начните вводить для поиска пользователя'}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-w-[400px] text-sm"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        disabled={searchLoading}
                    >
                        <option value="">— Снять владельца —</option>
                        {options.length === 0 && !searchLoading && (
                            <option value="" disabled>
                                {searchQuery.length >= 2 ? 'Ничего не найдено' : 'Начните поиск'}
                            </option>
                        )}
                        {searchLoading && (
                            <option value="" disabled>
                                Поиск...
                            </option>
                        )}
                        {options.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label}
                            </option>
                        ))}
                    </select>

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
