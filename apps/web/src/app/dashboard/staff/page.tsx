import StaffPageClient from './StaffPageClient';

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
        .order('full_name')
        .returns<Row[]>();

    if (error) {
        return (
            <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error.message}
                </div>
            </main>
        );
    }

    return <StaffPageClient initialRows={rows ?? []} showDismissed={showDismissed} />;
}
