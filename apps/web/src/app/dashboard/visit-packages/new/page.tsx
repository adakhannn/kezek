
import { getT } from '@/app/_components/i18n/server';
import VisitPackagePlanForm from '@/app/dashboard/visit-packages/VisitPackagePlanForm';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BranchRow = { id: string; name: string };
type ServiceRow = { id: string; name_ru: string; branch_id: string };

export default async function VisitPackageNewPage() {
    const { supabase, bizId } = await getBizContextForManagers();

    const [
        { data: branches, error: branchesError },
        { data: services, error: servicesError },
    ] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('services')
            .select('id,name_ru,branch_id')
            .eq('biz_id', bizId)
            .eq('active', true)
            .order('name_ru'),
    ]);

    // FE-08: a failed read is an error, not "no branches" / "no services".
    if (branchesError || servicesError) {
        logError('VisitPackageNewPage', 'Failed to load branches or services', { bizId, branchesError, servicesError });
        return <LoadFailedNotice page />;
    }

    const branchList = (branches ?? []) as BranchRow[];
    const serviceList = (services ?? []) as ServiceRow[];
    const t = await getT();

    return (
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {t('dashboard.visitPackages.form.createTitle', 'Новый тип пакета')}
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('dashboard.visitPackages.form.createSubtitle', 'Заполните параметры пакета визитов для продажи клиентам.')}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                    <VisitPackagePlanForm
                        initial={{
                            name_ru: '',
                            name_ky: null,
                            name_en: null,
                            visit_count: 5,
                            validity_days: 30,
                            discount_type: 'percent',
                            discount_value: 10,
                            service_id: null,
                            branch_ids: null,
                        }}
                        branches={branchList}
                        services={serviceList}
                    />
                </div>
            </div>
        </div>
    );
}
