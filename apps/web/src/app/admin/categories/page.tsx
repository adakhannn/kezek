import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/server';
import { DeleteCategoryButton } from '@/components/admin/categories/DeleteCategoryButton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';

export const dynamic = 'force-dynamic';

type CategoryUsageRow = {
    id: string;
    name_ru: string;
    slug: string;
    is_active: boolean;
    usage_count: number;
};

export default async function CategoriesPage() {
    const t = getT('ru');
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const {
        data: { user },
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">{t('admin.error.unauthorized', 'РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ')}</div>;

    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">{t('admin.error.load', 'РћС€РёР±РєР°')}: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">{t('admin.noAccess.title', 'РќРµС‚ РґРѕСЃС‚СѓРїР°')}</div>;

    const { data: rpcData, error } = await supa.rpc('categories_with_usage_v2');
    if (error) return <div className="p-4">{t('admin.error.load', 'РћС€РёР±РєР°')}: {error.message}</div>;

    const list: CategoryUsageRow[] = Array.isArray(rpcData) ? (rpcData as CategoryUsageRow[]) : [];

    const totalCategories = list.length;
    const activeCategories = list.filter((c) => c.is_active).length;
    const totalUsage = list.reduce((sum, c) => sum + c.usage_count, 0);
    const mostUsed = list.length > 0 ? list.reduce((max, c) => (c.usage_count > max.usage_count ? c : max), list[0]) : null;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <PageHeader
                    title={t('admin.categories.title', 'РљР°С‚РµРіРѕСЂРёРё Р±РёР·РЅРµСЃР°')}
                    description={t('admin.categories.subtitle', 'РЈРїСЂР°РІР»РµРЅРёРµ РєР°С‚РµРіРѕСЂРёСЏРјРё РґР»СЏ Р±РёР·РЅРµСЃРѕРІ')}
                    actions={
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/admin">
                                <Button variant="outline" className="w-full sm:w-auto">
                                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    {t('admin.categories.backToAdmin', 'Р’ Р°РґРјРёРЅРєСѓ')}
                                </Button>
                            </Link>
                            <Link href="/admin/categories/new">
                                <Button className="w-full sm:w-auto">
                                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    {t('admin.categories.new', 'РќРѕРІР°СЏ РєР°С‚РµРіРѕСЂРёСЏ')}
                                </Button>
                            </Link>
                        </div>
                    }
                />

                <section className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
                                <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.categories.stats.total', 'Р’СЃРµРіРѕ РєР°С‚РµРіРѕСЂРёР№')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCategories}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.categories.stats.active', 'РђРєС‚РёРІРЅС‹С…')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeCategories}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.categories.stats.usage', 'РСЃРїРѕР»СЊР·РѕРІР°РЅРёР№')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalUsage}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {list.length > 0 ? (
                        <>
                            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                                <SectionHeader title={t('admin.categories.list.title', 'РЎРїРёСЃРѕРє РєР°С‚РµРіРѕСЂРёР№')} />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {t('admin.categories.table.name', 'РќР°Р·РІР°РЅРёРµ')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {t('admin.categories.table.slug', 'Slug')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {t('admin.categories.table.status', 'РЎС‚Р°С‚СѓСЃ')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {t('admin.categories.table.usage', 'РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ')}
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {t('admin.categories.table.actions', 'Р”РµР№СЃС‚РІРёСЏ')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                                        {list.map((c) => (
                                            <tr key={c.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
                                                            <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                            </svg>
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name_ru}</div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="inline-block rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                                        {c.slug}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <StatusChip
                                                        status={c.is_active ? 'active' : 'inactive'}
                                                        label={
                                                            c.is_active
                                                                ? t('admin.categories.status.active', 'РђРєС‚РёРІРЅР°')
                                                                : t('admin.categories.status.inactive', 'Р’С‹РєР»СЋС‡РµРЅР°')
                                                        }
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.usage_count}</span>
                                                        {c.usage_count > 0 ? (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {c.usage_count === 1
                                                                    ? t('admin.categories.usage.one', 'Р±РёР·РЅРµСЃ')
                                                                    : c.usage_count < 5
                                                                      ? t('admin.categories.usage.few', 'Р±РёР·РЅРµСЃР°')
                                                                      : t('admin.categories.usage.many', 'Р±РёР·РЅРµСЃРѕРІ')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <Link
                                                            href={`/admin/categories/${c.id}`}
                                                            className="inline-flex items-center gap-1.5 text-indigo-600 transition-colors hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                            {t('admin.categories.edit', 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ')}
                                                        </Link>
                                                        <DeleteCategoryButton id={c.id} slug={c.slug} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {mostUsed && mostUsed.usage_count > 0 ? (
                                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span>
                                            {t('admin.categories.mostPopular', 'РЎР°РјР°СЏ РїРѕРїСѓР»СЏСЂРЅР°СЏ')}: <strong className="text-gray-900 dark:text-gray-100">{mostUsed.name_ru}</strong> ({mostUsed.usage_count}{' '}
                                            {mostUsed.usage_count === 1 ? t('admin.categories.usage.one', 'Р±РёР·РЅРµСЃ') : t('admin.categories.usage.many', 'Р±РёР·РЅРµСЃРѕРІ')})
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="px-6 py-8">
                            <EmptyState
                                icon={
                                    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                }
                                title={t('admin.categories.empty.title', 'РљР°С‚РµРіРѕСЂРёР№ РїРѕРєР° РЅРµС‚')}
                                description={t('admin.categories.empty.description', 'РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ РєР°С‚РµРіРѕСЂРёСЋ РґР»СЏ РѕСЂРіР°РЅРёР·Р°С†РёРё Р±РёР·РЅРµСЃРѕРІ')}
                                action={
                                    <Link href="/admin/categories/new">
                                        <Button>
                                            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            {t('admin.categories.empty.create', 'РЎРѕР·РґР°С‚СЊ РїРµСЂРІСѓСЋ РєР°С‚РµРіРѕСЂРёСЋ')}
                                        </Button>
                                    </Link>
                                }
                            />
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
