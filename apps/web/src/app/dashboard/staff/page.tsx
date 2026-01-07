import Link from 'next/link';

import StaffListClient from './StaffListClient';

import FlashBanner from '@/app/dashboard/staff/FlashBanner';
import { getBizContextForManagers } from '@/lib/authBiz';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    // join объектом, а не массивом
    branches: { name: string } | null;
};

export default async function Page({
                                       // ВАЖНО: в проекте searchParams это Promise<...>
                                       searchParams,
                                   }: {
    searchParams?: Promise<{ dismissed?: string | string[] }>;
}) {
    const { supabase, bizId } = await getBizContextForManagers();

    // распаковываем и нормализуем dismissed
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    const dismissedParam = Array.isArray(sp.dismissed) ? sp.dismissed[0] : sp.dismissed;
    const showDismissed = dismissedParam === '1';

    const { data: rows, error } = await supabase
        .from('staff')
        .select('id,full_name,is_active,branch_id,branches(name)')
        .eq('biz_id', bizId)
        .order('full_name');

    if (error) {
        return (
            <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    Ошибка загрузки: {error.message}
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8 space-y-6">
            {/* Заголовок и кнопка добавления */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Сотрудники</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Управление сотрудниками и их услугами
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/staff/finance"
                        className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
                        </svg>
                        Финансы
                    </Link>
                    <Link
                        href="/dashboard/staff/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Добавить сотрудника
                    </Link>
                </div>
            </div>

            <FlashBanner showInitially={showDismissed} text="Сотрудник уволен." />

            <StaffListClient initialRows={(rows as unknown as Row[]) || []} />
        </main>
    );
}
