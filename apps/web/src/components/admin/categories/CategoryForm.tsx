'use client';

import { Check, ExternalLink, Link2, Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { buttonStyles } from '@/components/ui/buttonStyles';

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

/** Transliterate RU/KY text and normalize it for URL-safe slugs. */
function makeSlug(input: string): string {
    const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
        к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
        х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ъ: '', ь: '',
        ң: 'ng', ү: 'u', ө: 'o', қ: 'k', ғ: 'g', ә: 'a', ұ: 'u', і: 'i', һ: 'h',
    };

    const lower = input.toLowerCase().trim();
    let out = '';
    for (const ch of lower) out += map[ch] ?? ch;

    return out
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function isValidSlug(value: string): boolean {
    if (!value.trim()) return true;
    return /^[a-z0-9-]{2,}$/.test(value);
}

export function CategoryForm({ mode, categoryId, initial }: Props) {
    const router = useRouter();

    const [nameRu, setNameRu] = useState<string>(initial?.name_ru ?? '');
    const [slug, setSlug] = useState<string>(initial?.slug ?? '');
    const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [slugDirty, setSlugDirty] = useState<boolean>(false);
    const initRef = useRef(false);

    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            if (mode === 'edit' && initial?.slug) setSlugDirty(true);
        }

        if (slugDirty) return;

        if (!nameRu.trim()) {
            setSlug('');
            return;
        }

        setSlug((prev) => {
            const next = makeSlug(nameRu);
            return prev === next ? prev : next;
        });
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
                        slug: slug.trim() ? makeSlug(slug) : null,
                        is_active: isActive,
                    } satisfies CreateBody)
                    : {
                        name_ru: nameRu.trim() || null,
                        slug: slug.trim() ? makeSlug(slug) : null,
                        is_active: isActive,
                        propagateSlug: true,
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

            if (!resp.ok || !data || !data.ok) {
                const apiErr = (data && 'error' in data ? data.error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push('/admin/categories');
            router.refresh();
        } catch (e) {
            setError(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-7">
            <div className="space-y-5">
                <Input
                    label="Название категории"
                    placeholder="Например: Парикмахерская"
                    value={nameRu}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameRu(e.target.value)}
                    required
                    autoComplete="off"
                    helperText="Показывается владельцам бизнеса и клиентам."
                />

                <Input
                    label="Адрес публичной страницы"
                    placeholder="formiruetsya-avtomaticheski"
                    value={slug}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSlug(e.target.value);
                        setSlugDirty(true);
                    }}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        const value = e.target.value.trim();
                        if (!value) {
                            setSlugDirty(false);
                            setSlug(makeSlug(nameRu));
                            return;
                        }
                        setSlug(makeSlug(value));
                    }}
                    helperText={
                        slugDirty
                            ? 'Адрес будет нормализован: допустимы латиница, цифры и дефисы.'
                            : 'Формируется автоматически из названия. При необходимости его можно изменить.'
                    }
                />
                {slug && (
                    <div
                        className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3"
                        aria-live="polite"
                    >
                        <Link2 className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                                Будущий адрес
                            </p>
                            <code className="mt-0.5 block truncate text-sm text-[var(--text-primary)]">
                                kezek.kg/b/{makeSlug(slug)}
                            </code>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
                    className="peer sr-only"
                    aria-label="Доступна для выбора"
                />
                <label
                    htmlFor="is_active"
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-lg peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-[var(--surface-emphasis)]"
                >
                    <span className="min-w-0">
                        <span className="block font-medium text-[var(--text-primary)]">Доступна для выбора</span>
                        <span className="mt-1 block text-sm leading-5 text-[var(--text-muted)]">
                            Владельцы смогут назначать эту категорию своим бизнесам.
                        </span>
                    </span>
                    <span
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                            isActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-strong)]'
                        }`}
                        aria-hidden="true"
                    >
                        <span
                            className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        >
                            {isActive ? <Check className="h-3 w-3 text-[var(--accent-primary)]" /> : null}
                        </span>
                    </span>
                </label>
            </div>

            {mode === 'edit' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex gap-3">
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <p className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-300">
                                Изменение slug
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Изменение slug может быть распространено на связанные бизнесы (если эта опция включена в API).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {error ? <AlertBanner variant="danger" title="Ошибка" message={error} /> : null}

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Link
                    href="/admin/categories"
                    className={buttonStyles({
                        variant: 'ghost',
                        className: 'w-full text-[var(--text-secondary)] sm:w-auto',
                    })}
                >
                    Отмена
                </Link>
                <div className="flex w-full items-center gap-4 sm:w-auto">
                    {mode === 'edit' && !changed && (
                        <span className="hidden items-center gap-2 text-sm text-[var(--text-muted)] sm:flex">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Изменений нет
                        </span>
                    )}
                    <Button
                        type="submit"
                        disabled={mode === 'edit' ? !changed : false}
                        isLoading={loading}
                        className="w-full min-w-[160px] sm:w-auto"
                        leadingIcon={mode === 'create' ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    >
                        {mode === 'create' ? 'Создать категорию' : 'Сохранить изменения'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
