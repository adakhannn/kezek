'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

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
        }
    }

    const [error, setError] = useState<string | null>(null);

    return (
        <form onSubmit={submit} className="space-y-3 max-w-xl">
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Название (ru) *"
                value={nameRu}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameRu(e.target.value)}
                required
            />

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Slug (латиница)"
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
            />

            <label className="inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
                />
                Активна
            </label>

            {mode === 'edit' && (
                <p className="text-xs text-gray-500">
                    Изменение slug (при отмеченной опции в API) может быть распространено на связанные бизнесы.
                </p>
            )}

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <button
                className="border rounded px-3 py-2"
                disabled={mode === 'edit' ? !changed : false}
                type="submit"
            >
                {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
            {mode === 'edit' && !changed && (
                <span className="ml-2 text-xs text-gray-500">Нет изменений</span>
            )}
        </form>
    );
}
