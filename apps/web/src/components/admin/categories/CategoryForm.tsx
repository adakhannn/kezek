'use client';

import {useRouter} from 'next/navigation';
import React, {useEffect, useMemo, useState} from 'react';

type Props = {
    mode: 'create' | 'edit';
    categoryId?: string;
    initial?: { name_ru: string; name_ky: string; slug: string; is_active: boolean };
};

type ApiOk = { ok: true; id?: string };
type ApiErr = { ok: false; error?: string };
type ApiResp = ApiOk | ApiErr;

type CreateBody = {
    name_ru: string;
    name_ky: string | null;
    slug: string | null;
    is_active: boolean;
};
type UpdateBody = {
    name_ru: string | null;
    name_ky: string | null;
    slug: string | null;
    is_active: boolean;
    propagateSlug: boolean;
};

function translitCyrToLat(s: string): string {
    // Простая транслитерация для ru/ky, затем нормализация в slug
    return s
        .toLowerCase()
        .replace(/а/g, 'a')
        .replace(/б/g, 'b')
        .replace(/в/g, 'v')
        .replace(/г/g, 'g')
        .replace(/д/g, 'd')
        .replace(/е|ё/g, 'e')
        .replace(/ж/g, 'zh')
        .replace(/з/g, 'z')
        .replace(/и/g, 'i')
        .replace(/й/g, 'y')
        .replace(/к/g, 'k')
        .replace(/л/g, 'l')
        .replace(/м/g, 'm')
        .replace(/н/g, 'n')
        .replace(/о/g, 'o')
        .replace(/п/g, 'p')
        .replace(/р/g, 'r')
        .replace(/с/g, 's')
        .replace(/т/g, 't')
        .replace(/у/g, 'u')
        .replace(/ф/g, 'f')
        .replace(/х/g, 'h')
        .replace(/ц/g, 'c')
        .replace(/ч/g, 'ch')
        .replace(/ш/g, 'sh')
        .replace(/щ/g, 'sch')
        .replace(/ъ|ь/g, '')
        .replace(/ы/g, 'y')
        .replace(/э/g, 'e')
        .replace(/ю/g, 'yu')
        .replace(/я/g, 'ya')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/--+/g, '-');
}

function isValidSlug(s: string): boolean {
    // Разрешаем пустой (бэкенд может сам сгенерить), иначе латиница/цифры/дефис
    if (!s.trim()) return true;
    return /^[a-z0-9-]{2,}$/.test(s);
}

export function CategoryForm({mode, categoryId, initial}: Props) {
    const router = useRouter();
    const [nameRu, setNameRu] = useState<string>(initial?.name_ru ?? '');
    const [nameKy, setNameKy] = useState<string>(initial?.name_ky ?? '');
    const [slug, setSlug] = useState<string>(initial?.slug ?? '');
    const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
    const [propagateSlug, setPropagateSlug] = useState<boolean>(true);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // авто-slug при создании
    useEffect(() => {
        if (mode !== 'create') return;
        if (!nameRu || slug) return;
        setSlug(translitCyrToLat(nameRu));
    }, [nameRu, slug, mode]);

    const changed = useMemo(() => {
        if (mode === 'create') {
            return !!(nameRu || nameKy || slug || !isActive); // грубо: что-то ввели/поменяли
        }
        return (
            nameRu !== (initial?.name_ru ?? '') ||
            nameKy !== (initial?.name_ky ?? '') ||
            slug !== (initial?.slug ?? '') ||
            isActive !== (initial?.is_active ?? true)
        );
    }, [mode, nameRu, nameKy, slug, isActive, initial]);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            if (!nameRu.trim()) {
                throw new Error('Название (ru) обязательно');
            }
            if (!isValidSlug(slug)) {
                throw new Error('Slug должен быть латиницей/цифрами и дефисом (минимум 2 символа), либо пустым');
            }

            const url =
                mode === 'create'
                    ? '/admin/api/categories/create'
                    : `/admin/api/categories/${categoryId}/update`;

            const body: CreateBody | UpdateBody =
                mode === 'create'
                    ? {
                        name_ru: nameRu.trim(),
                        name_ky: nameKy.trim() || null,
                        slug: slug.trim() || null,
                        is_active: isActive,
                    }
                    : {
                        name_ru: nameRu.trim() || null,
                        name_ky: nameKy.trim() || null,
                        slug: slug.trim() || null,
                        is_active: isActive,
                        propagateSlug,
                    };

            const resp = await fetch(url, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
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
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push('/admin/categories');
            router.refresh();
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

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
                placeholder="Название (ky)"
                value={nameKy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameKy(e.target.value)}
            />
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Slug (латиница)"
                value={slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
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
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={propagateSlug}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPropagateSlug(e.target.checked)}
                    />
                    При смене slug заменить его во всех бизнесах
                </label>
            )}

            {err && <div className="text-red-600 text-sm">{err}</div>}

            <button
                className="border rounded px-3 py-2"
                disabled={loading || (mode === 'edit' && !changed)}
                type="submit"
                aria-busy={loading}
            >
                {loading ? 'Сохраняю…' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
            {mode === 'edit' && !changed && (
                <span className="ml-2 text-xs text-gray-500">Нет изменений</span>
            )}
        </form>
    );
}
