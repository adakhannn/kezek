'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
    bizId: string;
    initial: {
        name: string;
        slug: string;
        categories: string[];
        address: string | null;
        phones: string[] | null;
        is_approved: boolean;
        created_at: string | null;
    };
};

export function BusinessCardEdit({ bizId, initial }: Props) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState(initial.name);
    const [slug, setSlug] = useState(initial.slug);
    const [categoriesText, setCategoriesText] = useState((initial.categories || []).join(', '));
    const [address, setAddress] = useState(initial.address ?? '');
    const [phonesText, setPhonesText] = useState((initial.phones || []).join('\n'));
    const [isApproved, setIsApproved] = useState(initial.is_approved);

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        try {
            const categories = categoriesText
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean);
            const phones = phonesText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);

            const res = await fetch(`/admin/api/businesses/${bizId}/update`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    categories: categories.length ? categories : [],
                    address: address.trim() || null,
                    phones: phones.length ? phones : null,
                    is_approved: isApproved,
                }),
            });

            const json = await res.json();
            if (!json.ok) {
                setError(json.error || 'Ошибка сохранения');
                return;
            }
            setEditing(false);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setName(initial.name);
        setSlug(initial.slug);
        setCategoriesText((initial.categories || []).join(', '));
        setAddress(initial.address ?? '');
        setPhonesText((initial.phones || []).join('\n'));
        setIsApproved(initial.is_approved);
        setError(null);
        setEditing(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Основная информация</h2>
                </div>
                {!editing ? (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Редактировать
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                        >
                            Отмена
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                        >
                            {saving ? 'Сохранение…' : 'Сохранить'}
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                    {error}
                </div>
            )}

            {editing ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Название</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Slug (URL)</label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="my-business"
                            className="w-full font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Только латиница, цифры и дефис</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Категории (slug через запятую)</label>
                        <input
                            type="text"
                            value={categoriesText}
                            onChange={(e) => setCategoriesText(e.target.value)}
                            placeholder="salon, barbershop"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Адрес</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Телефоны (по одному на строку)</label>
                        <textarea
                            value={phonesText}
                            onChange={(e) => setPhonesText(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_approved"
                            checked={isApproved}
                            onChange={(e) => setIsApproved(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="is_approved" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Одобрен (виден на площадке)
                        </label>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Slug (URL)</label>
                        <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            /b/{initial.slug}
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Категории</label>
                        {(initial.categories?.length ?? 0) > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {initial.categories!.map((cat) => (
                                    <span
                                        key={cat}
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                    >
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Категории не указаны</p>
                        )}
                    </div>
                    {initial.address && (
                        <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Адрес</label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{initial.address}</p>
                        </div>
                    )}
                    {initial.phones && initial.phones.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Телефоны</label>
                            <div className="mt-1 space-y-1">
                                {initial.phones.map((phone, idx) => (
                                    <p key={idx} className="text-sm text-gray-900 dark:text-gray-100">
                                        {phone}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                    {initial.created_at && (
                        <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Дата создания</label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                                {new Date(initial.created_at).toLocaleDateString('ru-RU', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
