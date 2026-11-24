// apps/web/src/app/admin/businesses/[id]/branches/new/page.tsx
import Link from 'next/link';

import { getT } from '@/app/_components/i18n/server';
import { BranchForm } from '@/components/admin/branches/BranchForm';
import { Card } from '@/components/ui/Card';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
type RouteParams = { id: string };
export default async function BranchNewPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;
    const t = await getT();

    const supa = await createSupabaseServerClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">{t('admin.catalog.common.notAuthorized', 'Не авторизован')}</div>;
    const { data: isSuper } = await supa.rpc('is_super_admin');
    if (!isSuper) return <div className="p-4">{t('admin.catalog.common.noAccess', 'Нет доступа')}</div>;

    const admin = createSupabaseAdminClient();
    const [{ data: biz }, { count: branchCount }] = await Promise.all([
        admin.from('businesses').select('id,name,branch_limit').eq('id', id).maybeSingle(),
        admin.from('branches').select('id', { count: 'exact', head: true }).eq('biz_id', id),
    ]);

    if (!biz) return <div className="p-4">{t('admin.catalog.common.businessNotFound', 'Бизнес не найден')}</div>;
    if ((branchCount ?? 0) >= biz.branch_limit) {
        return <div className="p-4 text-amber-700">{t('admin.branchesPage.limitReached', 'Лимит филиалов достигнут: {count} из {limit}').replace('{count}', String(branchCount ?? 0)).replace('{limit}', String(biz.branch_limit))}</div>;
    }

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            {t('admin.branchesPage.newTitle', 'Новый филиал')}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('admin.catalog.common.businessLabel', 'Бизнес:')}{' '}<span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                        </p>
                    </div>
                    <Link
                        href={`/admin/businesses/${biz.id}/branches`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('admin.branchesPage.backToList', 'К списку филиалов')}
                    </Link>
                </div>
            </div>

            {/* Форма */}
            <Card className="p-6">
                <BranchForm
                    mode="create"
                    bizId={biz.id}
                    yandexMapsApiKey={process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
                />
            </Card>
        </div>
    );
}
