'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Props = {
    mode: 'create' | 'edit';
    categoryId?: string;
    initial?: { name_ru: string; slug: string; is_active: boolean };
};

type ApiOk = { ok: true; id?: string };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

type CreateBody = {
    name_ru: string;
    slug: string | null;
    is_active: boolean;
};

/** Транслитерация ru/ky + нормализация в slug */
function makeSlug(input: string): string {
    const map: Record<string, string> = {
        // ru
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
        к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
        х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ъ: '', ь: '',
        // ky (базово)
        ӊ: 'ng', ү: 'u', ө: 'o', Ң: 'ng', Ү: 'u', Ө: 'o',
    };

    const lower = input.toLowerCase().trim();
    let out = '';
    for (const ch of lower) out += map[ch] ?? ch;

    return out
        .replace(/[^a-z0-9]+/g, '-') // всё кроме латиницы/цифр → дефис
        .replace(/^-+|-+$/g, '')     // крайние дефисы
        .replace(/-+/g, '-');        // подряд дефисы → один
}

function isValidSlug(s: string): boolean {
    // Разрешаем пустой (бэкенд может сам сгенерить), иначе латиница/цифры/дефис, длина ≥2
    if (!s.trim()) return true;
    return /^[a-z0-9-]{2,}$/.test(s);
}

export function CategoryForm({ mode, categoryId, initial }: Props) {
    const router = useRouter();

    const [nameRu, setNameRu] = useState<string>(initial?.name_ru ?? '');
    const [slug, setSlug] = useState<string>(initial?.slug ?? '');
    const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
    const [loading, setLoading] = useState(false);

    // если пользователь трогал slug руками — авто-генерацию выключаем
    const [slugDirty, setSlugDirty] = useState<boolean>(false);

    // защита от двойного эффекта в dev
    const initRef = useRef(false);

    // Авто-slug из nameRu (и при create, и при edit), пока slug не редактировали вручную
    useEffect(() => {
        // при первом рендере, если есть initial.slug, считаем, что slug уже задан вручную
        if (!initRef.current) {
            initRef.current = true;
            if (mode === 'edit' && initial?.slug) setSlugDirty(true);
        }

        if (slugDirty) return;

        if (!nameRu.trim()) {
            setSlug('');
        } else {
            setSlug((prev) => {
                const next = makeSlug(nameRu);
                return prev === next ? prev : next;
            });
        }
    }, [nameRu, slugDirty, mode, initial?.slug]);

    const changed = useMemo(() => {
        if (mode === 'create') {
            return !!(nameRu || slug || !isActive);
        }
        return (
            nameRu !== (initial?.name_ru ?? '') ||
            slug !== (initial?.slug ?? '') ||
            isActive !== (initial?.is_active ?? true)
        );
    }, [mode, nameRu, slug, isActive, initial]);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        
        const url =
            mode === 'create'
                ? '/admin/api/categories/create'
                : `/admin/api/categories/${categoryId}/update`;

        try {
            if (!nameRu.trim()) throw new Error('Название (ru) обязательно');
            if (!isValidSlug(slug)) {
                throw new Error('Slug должен быть латиницей/цифрами и дефисом (минимум 2 символа), либо пустым');
            }

            const body =
                mode === 'create'
                    ? ({
                        name_ru: nameRu.trim(),
                        slug: slug.trim() ? makeSlug(slug) : null, // нормализуем перед отправкой
                        is_active: isActive,
                    } satisfies CreateBody)
                    : {
                        name_ru: nameRu.trim() || null,
                        slug: slug.trim() ? makeSlug(slug) : null,
                        is_active: isActive,
                        propagateSlug: true, // как раньше по умолчанию
                    };

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: ApiResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as ApiResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 1500));
                data = { ok: true };
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push('/admin/categories');
            router.refresh();
        } catch (e) {
            // мягко показываем ошибку
            setError(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    const [error, setError] = useState<string | null>(null);

    return (
        <form onSubmit={submit} className="space-y-6">
            {/* Название */}
            <div>
                <Input
                    label="Название категории"
                    placeholder="Например: Парикмахерская"
                    value={nameRu}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameRu(e.target.value)}
                    required
                    helperText="Название категории на русском языке"
                />
            </div>

            {/* Slug */}
            <div>
                <Input
                    label="Slug (URL-идентификатор)"
                    placeholder="Автоматически генерируется из названия"
                    value={slug}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSlug(e.target.value);
                        setSlugDirty(true); // пользователь начал править — отключаем авто
                    }}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        const v = e.target.value.trim();
                        if (!v) {
                            // очищено — снова включаем автогенерацию
                            setSlugDirty(false);
                            setSlug(makeSlug(nameRu));
                        } else {
                            setSlug(makeSlug(v)); // нормализуем вручную введённый slug
                        }
                    }}
                    helperText={
                        slugDirty 
                            ? "Slug будет автоматически нормализован (латиница, дефисы)"
                            : "Slug генерируется автоматически из названия. Можно редактировать вручную."
                    }
                />
                {slug && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Предпросмотр:</p>
                        <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
                            /b/{makeSlug(slug)}
                        </code>
                    </div>
                )}
            </div>

            {/* Статус */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                />
                <label htmlFor="is_active" className="flex-1 cursor-pointer">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Активна</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Активные категории доступны для выбора при создании бизнеса
                    </div>
                </label>
            </div>

            {/* Предупреждение для редактирования */}
            {mode === 'edit' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex gap-3">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                                Изменение slug
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Изменение slug может быть распространено на связанные бизнесы (если опция включена в API).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Ошибка */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex gap-3">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300">Ошибка</p>
                            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Кнопки */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                    type="submit"
                    disabled={mode === 'edit' ? !changed : false}
                    isLoading={loading}
                    className="min-w-[140px]"
                >
                    {mode === 'create' ? (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Создать
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Сохранить
                        </>
                    )}
                </Button>
                {mode === 'edit' && !changed && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Нет изменений
                    </span>
                )}
            </div>
        </form>
    );
}
