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
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            Создать бизнес
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Добавление нового бизнеса в систему
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/businesses"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            К бизнесам
                        </Link>
                        <Link
                            href="/admin/categories"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Справочник категорий
                        </Link>
                    </div>
                </div>
            </div>

            {/* Форма */}
            <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 space-y-8 max-w-3xl">
                {/* Основная информация */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Основная информация</h2>
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="Название бизнеса"
                            placeholder="Например: Парикмахерская «Стиль»"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            helperText="Полное название бизнеса, которое будет отображаться пользователям"
                        />

                        <div>
                            <Input
                                label="Slug (URL-адрес)"
                                placeholder="Например: parikmaherskaya-stil"
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
                                helperText={
                                    slugDirty
                                        ? 'Slug будет автоматически нормализован при сохранении'
                                        : 'Автоматически генерируется из названия. Можно изменить вручную.'
                                }
                            />
                            {slug && (
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 rounded p-2 border border-gray-200 dark:border-gray-700">
                                    URL: <span className="text-indigo-600 dark:text-indigo-400">/b/{slug}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Выбор категорий */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Категории</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Выберите одну или несколько категорий *</p>
                            </div>
                        </div>
                        <Link
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                            href="/admin/categories/new"
                            title="Добавить категорию"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Новая категория
                        </Link>
                    </div>

                    {/* Поиск категорий */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <Input
                            placeholder="Поиск по названию или slug…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Список категорий */}
                    <div className="max-h-64 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        {visibleCats.length > 0 ? (
                            visibleCats.map((c) => {
                                const isSelected = selected.includes(c.slug);
                                return (
                                    <label
                                        key={c.id}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200
                                            ${isSelected
                                                ? 'bg-gradient-to-r from-indigo-50 to-pink-50 dark:from-indigo-900/30 dark:to-pink-900/30 border-2 border-indigo-500 dark:border-indigo-400'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent'
                                            }
                                        `}
                                    >
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggle(c.slug)}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 dark:border-gray-700 cursor-pointer"
                                            />
                                            {isSelected && (
                                                <svg className="absolute inset-0 w-5 h-5 text-indigo-600 dark:text-indigo-400 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {c.name_ru}
                                            </span>
                                            <span className={`ml-2 text-xs ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                ({c.slug})
                                            </span>
                                        </div>
                                    </label>
                                );
                            })
                        ) : (
                            <div className="text-center py-8">
                                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {search ? 'Ничего не найдено' : 'Нет доступных категорий'}
                                </p>
                                {!search && (
                                    <Link
                                        href="/admin/categories/new"
                                        className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        Создать первую категорию
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Выбранные категории */}
                    {selected.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Выбрано: {selected.length} {selected.length === 1 ? 'категория' : selected.length < 5 ? 'категории' : 'категорий'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {selected.map((sl) => {
                                    const cat = allCats.find((c) => c.slug === sl);
                                    return (
                                        <span
                                            key={sl}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-indigo-100 to-pink-100 dark:from-indigo-900/30 dark:to-pink-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700"
                                        >
                                            {cat?.name_ru || sl}
                                            <button
                                                type="button"
                                                className="opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
                                                onClick={() => toggle(sl)}
                                                aria-label={`Удалить ${cat?.name_ru || sl}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Подсказка */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-blue-800 dark:text-blue-300">
                                <p className="font-medium mb-1">Как работают категории?</p>
                                <p className="text-blue-700 dark:text-blue-400">
                                    Категории помогают пользователям находить ваш бизнес. Выберите все категории, которые подходят вашему бизнесу. 
                                    В базе данных они сохраняются как массив slug'ов в поле <code className="font-mono text-xs bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">businesses.categories</code>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ошибки */}
                {err && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-red-800 dark:text-red-300 text-sm font-medium mb-1">Ошибка</p>
                                <p className="text-red-700 dark:text-red-400 text-sm">{err}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Кнопка отправки */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                        href="/admin/businesses"
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        Отмена
                    </Link>
                    <Button
                        type="submit"
                        disabled={loading || !name.trim() || !slug.trim() || selected.length === 0}
                        isLoading={loading}
                        className="min-w-[160px]"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Создаём…
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Создать бизнес
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
