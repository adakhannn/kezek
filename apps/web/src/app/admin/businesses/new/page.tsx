'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabaseClient';

type CatRow = { id: string; slug: string; name_ru: string; is_active: boolean };

/** Транслитерация + нормализация в slug */
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

export default function NewBizPage() {
    // Бизнес
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugDirty, setSlugDirty] = useState(false); // пользователь редактировал slug вручную

    // Категории из справочника
    const [allCats, setAllCats] = useState<CatRow[]>([]);
    const [selected, setSelected] = useState<string[]>([]); // массив SLUG'ов
    const [search, setSearch] = useState('');

    // Тех. состояние
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // защита от двойного эффекта в dev
    const initRef = useRef(false);

    // Подтягиваем категории из public.categories (только активные)
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        let ignore = false;
        (async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('id,slug,name_ru,is_active')
                .order('name_ru', { ascending: true });

            if (error) {
                console.error(error);
                setErr(error.message);
                return;
            }
            if (!ignore) {
                const rows = (data || []).filter((c) => c.is_active !== false);
                setAllCats(rows);

                // если есть barbershop — выберем по умолчанию
                if (rows.length && selected.length === 0) {
                    const def = rows.find((c) => c.slug === 'barbershop');
                    if (def) setSelected(['barbershop']);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, []);

    // Автогенерация slug из имени, пока пользователь не правил slug вручную
    useEffect(() => {
        if (!slugDirty) {
            if (!name.trim()) {
                setSlug('');
            } else {
                setSlug((prev) => {
                    const next = makeSlug(name);
                    return prev === next ? prev : next;
                });
            }
        }
    }, [name, slugDirty]);

    function toggle(sl: string) {
        setSelected((prev) => (prev.includes(sl) ? prev.filter((x) => x !== sl) : [...prev, sl]));
    }

    const visibleCats = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allCats;
        return allCats.filter(
            (c) => c.slug.toLowerCase().includes(q) || (c.name_ru ?? '').toLowerCase().includes(q)
        );
    }, [allCats, search]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setErr(null);

        try {
            if (!selected.length) throw new Error('Выберите хотя бы одну категорию');
            if (!name.trim()) throw new Error('Заполните название');
            if (!slug.trim()) throw new Error('Заполните slug');

            const payload = {
                name: name.trim(),
                slug: makeSlug(slug), // на всякий, нормализуем перед отправкой
                categories: selected, // массив SLUG'ов из справочника
            };

            const resp = await fetch('/admin/api/businesses/create', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const ct = resp.headers.get('content-type') || '';
            const j = ct.includes('json')
                ? await resp.json()
                : { error: (await resp.text()).slice(0, 1000) };

            if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP ${resp.status}`);

            // после создания ведём на страницу бизнеса
            location.href = `/admin/businesses/${j.id}`;
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Создать бизнес</h1>
                        <p className="text-gray-600 dark:text-gray-400">Добавление нового бизнеса в систему</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/admin/businesses" className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            К бизнесам
                        </Link>
                        <Link href="/admin/categories" className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                            Справочник категорий
                        </Link>
                    </div>
                </div>
            </div>

            <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6 max-w-2xl">
                <div className="space-y-4">
                    <Input
                        label="Название"
                        placeholder="Название бизнеса"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <Input
                        label="Slug"
                        placeholder="Slug (латиница)"
                        value={slug}
                        onChange={(e) => {
                            setSlug(e.target.value);
                            setSlugDirty(true);
                        }}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v) {
                                setSlugDirty(false);
                                setSlug(makeSlug(name));
                            } else {
                                setSlug(makeSlug(v));
                            }
                        }}
                        required
                        helperText="Автоматически генерируется из названия"
                    />
                </div>

                {/* Выбор категорий из справочника */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Категории *</label>
                        <Link
                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                            href="/admin/categories/new"
                            title="Добавить категорию"
                        >
                            + Новая категория
                        </Link>
                    </div>

                    <Input
                        placeholder="Поиск по названию/slug…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="max-h-56 overflow-auto bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        {visibleCats.map((c) => (
                            <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(c.slug)}
                                    onChange={() => toggle(c.slug)}
                                    className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{c.name_ru}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">({c.slug})</span>
                            </label>
                        ))}
                        {visibleCats.length === 0 && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                                Нет категорий. Создайте в «Справочнике категорий».
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {selected.map((sl) => (
                            <span
                                key={sl}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                            >
                                {sl}
                                <button
                                    type="button"
                                    className="opacity-60 hover:opacity-100 transition-opacity"
                                    onClick={() => toggle(sl)}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        В БД сохраняем как массив slug'ов: <code className="font-mono">businesses.categories text[]</code>.
                    </p>
                </div>

                {err && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                    </div>
                )}

                <div className="pt-2">
                    <Button type="submit" disabled={loading} isLoading={loading}>
                        {loading ? 'Создаём…' : 'Создать бизнес'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
