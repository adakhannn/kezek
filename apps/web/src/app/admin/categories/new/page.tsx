import { createServerClient } from '@supabase/ssr';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { CategoryForm } from '@/components/admin/categories/CategoryForm';
import { buttonStyles } from '@/components/ui/buttonStyles';

export const dynamic = 'force-dynamic';

export default async function CategoryNewPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const params = await searchParams;
    const proposedName = typeof params.name === 'string' ? params.name.trim().slice(0, 120) : '';

    return (
        <main className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/admin/categories"
                    className={buttonStyles({
                        variant: 'ghost',
                        size: 'sm',
                        className: '-ml-3 mb-5 text-[var(--text-muted)]',
                    })}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Категории
                </Link>

                <header className="mb-6 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-md)]">
                        <FolderPlus className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                            Каталог бизнесов
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                            Новая категория
                        </h1>
                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                            Категория станет доступна при создании и редактировании бизнеса.
                        </p>
                        {proposedName ? (
                            <div className="mt-3 inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                                Название перенесено из заявки бизнеса
                            </div>
                        ) : null}
                    </div>
                </header>

                <section
                    aria-label="Создание категории"
                    className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)]"
                >
                    <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-7">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-emphasis)] text-xs font-semibold text-[var(--accent-primary)]">
                                1
                            </span>
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">Параметры категории</h2>
                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                    Укажите понятное клиентам название. URL сформируется автоматически.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 sm:p-7">
                        <CategoryForm
                            mode="create"
                            initial={proposedName ? { name_ru: proposedName, slug: '', is_active: true } : undefined}
                        />
                    </div>
                </section>
            </div>
        </main>
    );
}
