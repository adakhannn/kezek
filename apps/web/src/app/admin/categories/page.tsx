import { createServerClient } from '@supabase/ssr';
import { ArrowLeft, Building2, CheckCircle2, Pencil, Plus, Tag, TrendingUp } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/server';
import { DeleteCategoryButton } from '@/components/admin/categories/DeleteCategoryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { buttonStyles } from '@/components/ui/buttonStyles';

export const dynamic = 'force-dynamic';

type CategoryUsageRow = {
    id: string;
    name_ru: string;
    slug: string;
    is_active: boolean;
    usage_count: number;
};

export default async function CategoriesPage() {
    const t = await getT();
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const {
        data: { user },
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">{t('admin.error.unauthorized', 'Не авторизован')}</div>;

    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">{t('admin.error.load', 'Ошибка')}: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">{t('admin.noAccess.title', 'Нет доступа')}</div>;

    const { data: rpcData, error } = await supa.rpc('categories_with_usage_v2');
    if (error) return <div className="p-4">{t('admin.error.load', 'Ошибка')}: {error.message}</div>;

    const list: CategoryUsageRow[] = Array.isArray(rpcData) ? (rpcData as CategoryUsageRow[]) : [];

    const totalCategories = list.length;
    const activeCategories = list.filter((c) => c.is_active).length;
    const totalUsage = list.reduce((sum, c) => sum + c.usage_count, 0);
    const mostUsed = list.length > 0 ? list.reduce((max, c) => (c.usage_count > max.usage_count ? c : max), list[0]) : null;

    const usageLabel = (count: number) =>
        count === 1
            ? t('admin.categories.usage.one', 'бизнес')
            : count > 1 && count < 5
              ? t('admin.categories.usage.few', 'бизнеса')
              : t('admin.categories.usage.many', 'бизнесов');

    const stats = [
        {
            label: t('admin.categories.stats.total', 'Всего категорий'),
            value: totalCategories,
            icon: Tag,
            tone: 'bg-indigo-500/10 text-indigo-400',
        },
        {
            label: t('admin.categories.stats.active', 'Активных'),
            value: activeCategories,
            icon: CheckCircle2,
            tone: 'bg-emerald-500/10 text-emerald-400',
        },
        {
            label: t('admin.categories.stats.usage', 'Использований'),
            value: totalUsage,
            icon: Building2,
            tone: 'bg-fuchsia-500/10 text-fuchsia-400',
        },
    ];

    return (
        <main className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <Link
                    href="/admin"
                    className={buttonStyles({
                        variant: 'ghost',
                        size: 'sm',
                        className: '-ml-3 text-[var(--text-muted)]',
                    })}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {t('admin.categories.backToAdmin', 'В админку')}
                </Link>

                <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                            Каталог бизнесов
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                            {t('admin.categories.title', 'Категории бизнеса')}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                            {t('admin.categories.subtitle', 'Управление категориями для бизнесов')}
                        </p>
                    </div>
                    <Link
                        href="/admin/categories/new"
                        className={buttonStyles({
                            className: 'w-full sm:w-auto',
                        })}
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('admin.categories.new', 'Новая категория')}
                    </Link>
                </header>

                <section aria-label="Статистика категорий" className="grid gap-3 sm:grid-cols-3">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div
                                key={stat.label}
                                className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-sm)]"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
                                    <p className="mt-0.5 text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                                </div>
                            </div>
                        );
                    })}
                </section>

                {list.length > 0 ? (
                    <section
                        aria-labelledby="categories-list-title"
                        className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)]"
                    >
                        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                            <div>
                                <h2 id="categories-list-title" className="text-lg font-semibold text-[var(--text-primary)]">
                                    {t('admin.categories.list.title', 'Список категорий')}
                                </h2>
                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                    {totalCategories} · {activeCategories} активных
                                </p>
                            </div>
                        </div>

                        <ul className="divide-y divide-[var(--border-subtle)]">
                            {list.map((category) => (
                                <li
                                    key={category.id}
                                    className="grid gap-4 px-5 py-5 transition-colors hover:bg-[var(--surface-emphasis)] sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(160px,1fr)_140px_auto] lg:items-center"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                                            <Tag className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                {category.name_ru}
                                            </h3>
                                            <code className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                                                /b/{category.slug}
                                            </code>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 lg:block">
                                        <span className="text-xs text-[var(--text-muted)] lg:hidden">
                                            {t('admin.categories.table.status', 'Статус')}
                                        </span>
                                        <StatusChip
                                            status={category.is_active ? 'active' : 'inactive'}
                                            label={
                                                category.is_active
                                                    ? t('admin.categories.status.active', 'Активна')
                                                    : t('admin.categories.status.inactive', 'Выключена')
                                            }
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-3 text-sm lg:block">
                                        <span className="text-xs text-[var(--text-muted)] lg:hidden">
                                            {t('admin.categories.table.usage', 'Используется')}
                                        </span>
                                        <span className="font-medium text-[var(--text-primary)]">
                                            {category.usage_count}{' '}
                                            <span className="font-normal text-[var(--text-muted)]">
                                                {usageLabel(category.usage_count)}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-4 lg:border-0 lg:pt-0">
                                        <Link
                                            href={`/admin/categories/${category.id}`}
                                            className={buttonStyles({
                                                variant: 'secondary',
                                                size: 'sm',
                                                className: 'flex-1 lg:flex-none',
                                            })}
                                        >
                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                            {t('admin.categories.edit', 'Редактировать')}
                                        </Link>
                                        <DeleteCategoryButton
                                            id={category.id}
                                            name={category.name_ru}
                                            usageCount={category.usage_count}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {mostUsed && mostUsed.usage_count > 0 ? (
                            <div className="flex items-start gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-5 py-4 text-sm text-[var(--text-secondary)] sm:px-6">
                                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                                <span>
                                    {t('admin.categories.mostPopular', 'Самая популярная')}:{' '}
                                    <strong className="text-[var(--text-primary)]">{mostUsed.name_ru}</strong>
                                    {' · '}
                                    {mostUsed.usage_count} {usageLabel(mostUsed.usage_count)}
                                </span>
                            </div>
                        ) : null}
                    </section>
                ) : (
                    <EmptyState
                        icon={<Tag className="h-8 w-8" aria-hidden="true" />}
                        title={t('admin.categories.empty.title', 'Категорий пока нет')}
                        description={t('admin.categories.empty.description', 'Создайте первую категорию для организации бизнесов')}
                        action={
                            <Link href="/admin/categories/new" className={buttonStyles()}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                {t('admin.categories.empty.create', 'Создать первую категорию')}
                            </Link>
                        }
                    />
                )}
            </div>
        </main>
    );
}

