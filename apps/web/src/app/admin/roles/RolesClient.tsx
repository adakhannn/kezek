'use client';

import Link from 'next/link';
import React, {useEffect, useMemo, useState} from 'react';

import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';

type Role = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
    created_at?: string | null;
};

type ListRes = { ok: true; items: Role[] } | { ok: false; error: string };
type MutRes = { ok: true; id?: string } | { ok: false; error: string };

export default function RolesClient({baseURL}: { baseURL?: string }) {
    const prefix = baseURL ?? '';
    const api = useMemo(() => {
        return {
            list: `${prefix}/admin/api/roles/list`,
            remove: (rid: string) => `${prefix}/admin/api/roles/${encodeURIComponent(rid)}/delete`,
        };
    }, [prefix]);

    const [items, setItems] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const res = await fetch(api.list, {cache: 'no-store'});
            const json = (await res.json()) as ListRes;
            if (!res.ok || !('ok' in json) || json.ok !== true) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            setItems(json.items);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function onDelete(r: Role) {
        if (r.is_system) {
            setErr('Это системная роль — удаление запрещено.');
            return;
        }
        if (!confirm(`Удалить роль «${r.name}»?`)) return;

        try {
            setErr(null);
            setDeletingId(r.id);
            const res = await fetch(api.remove(r.id), {method: 'POST'});
            const json = (await res.json()) as MutRes;
            if (!res.ok || !json.ok) {
                throw new Error(('error' in json && json.error) || `HTTP ${res.status}`);
            }
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const systemRoles = items.filter(r => r.is_system);
    const customRoles = items.filter(r => !r.is_system);

    return (
        <div className="space-y-6">
            {/* Статистика */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Всего ролей</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{items.length}</p>
                        </div>
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Системных</p>
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{systemRoles.length}</p>
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Пользовательских</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{customRoles.length}</p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                    </div>
                </Card>
            </div>

            {loading ? (
                <Card className="p-12 text-center">
                    <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка ролей...</p>
                </Card>
            ) : items.length === 0 ? (
                <Card className="p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Ролей пока нет
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Создайте первую роль, чтобы начать работу
                    </p>
                    <Link href="/admin/roles/new">
                        <Button>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Создать роль
                        </Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(r => (
                        <Card key={r.id} className="p-6 hover:shadow-lg transition-all duration-200" hover>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        {r.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                        {r.key}
                                    </p>
                                </div>
                                {r.is_system && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 ml-2 flex-shrink-0">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" clipRule="evenodd" />
                                            <path fillRule="evenodd" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Системная
                                    </span>
                                )}
                            </div>

                            {r.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                    {r.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Link
                                    href={`/admin/roles/${r.id}`}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-md transition-all duration-200 text-sm font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Редактировать
                                </Link>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => onDelete(r)}
                                    disabled={!!r.is_system || deletingId === r.id}
                                    isLoading={deletingId === r.id}
                                    title={r.is_system ? 'Системную роль удалить нельзя' : 'Удалить'}
                                >
                                    {deletingId === r.id ? (
                                        'Удаляю…'
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {err && (
                <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-300">{err}</p>
                </Card>
            )}
        </div>
    );
}
