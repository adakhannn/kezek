'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

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
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Админка — Создать бизнес</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin/businesses" className="underline">
                        ← К бизнесам
                    </Link>
                    <Link href="/admin/categories" className="underline">
                        Справочник категорий
                    </Link>
                </div>
            </div>

            <form onSubmit={submit} className="space-y-4 max-w-xl">
                <div className="grid gap-2">
                    <input
                        className="border rounded px-3 py-2"
                        placeholder="Название *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <input
                        className="border rounded px-3 py-2"
                        placeholder="Slug * (латиница)"
                        value={slug}
                        onChange={(e) => {
                            setSlug(e.target.value);
                            setSlugDirty(true); // пользователь начал править — отключаем автогенерацию
                        }}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v) {
                                // очищено — снова включаем автогенерацию
                                setSlugDirty(false);
                                setSlug(makeSlug(name));
                            } else {
                                setSlug(makeSlug(v)); // нормализуем вручную введённый slug
                            }
                        }}
                        required
                    />
                </div>

                {/* Выбор категорий из справочника */}
                <div className="grid gap-2">
                    <label className="text-sm">Категории *</label>

                    <div className="flex gap-2">
                        <input
                            className="border rounded px-3 py-2 flex-1"
                            placeholder="Поиск по названию/slug…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Link
                            className="border rounded px-3 py-2 text-sm hover:bg-gray-50"
                            href="/admin/categories/new"
                            title="Добавить категорию"
                        >
                            + Новая категория
                        </Link>
                    </div>

                    <div className="max-h-56 overflow-auto border rounded p-2">
                        {visibleCats.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(c.slug)}
                                    onChange={() => toggle(c.slug)}
                                />
                                <span>{c.name_ru}</span>
                                <span className="text-xs text-gray-500">({c.slug})</span>
                            </label>
                        ))}
                        {visibleCats.length === 0 && (
                            <div className="text-sm text-gray-500">
                                Нет категорий. Создайте в «Справочнике категорий».
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {selected.map((sl) => (
                            <span
                                key={sl}
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm"
                            >
                {sl}
                                <button
                                    type="button"
                                    className="opacity-60 hover:opacity-100"
                                    onClick={() => toggle(sl)}
                                >
                  ×
                </button>
              </span>
                        ))}
                    </div>

                    <p className="text-xs text-gray-500">
                        В БД сохраняем как массив slug’ов: <code>businesses.categories text[]</code>.
                    </p>
                </div>

                {err && <div className="text-red-600 text-sm">{err}</div>}

                <button className="border px-3 py-2 rounded" disabled={loading} type="submit">
                    {loading ? 'Создаём…' : 'Создать бизнес'}
                </button>
            </form>
        </main>
    );
}
