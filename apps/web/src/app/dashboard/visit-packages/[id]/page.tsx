import { notFound } from 'next/navigation';

import VisitPackagePlanForm from '@/app/dashboard/visit-packages/VisitPackagePlanForm';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BranchRow = { id: string; name: string };
type ServiceRow = { id: string; name_ru: string; branch_id: string };
type PlanRow = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
    validity_days: number;
    discount_type: 'percent' | 'fixed_price';
    discount_value: number;
    service_id: string | null;
    branch_ids: string[] | null;
    is_active: boolean;
};

export default async function VisitPackageEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    const [
        { data: plan, error: planError },
        { data: branches },
        { data: services },
    ] = await Promise.all([
        supabase
            .from('visit_package_plans')
            .select('id,name_ru,name_ky,name_en,visit_count,validity_days,discount_type,discount_value,service_id,branch_ids,is_active')
            .eq('id', id)
            .eq('biz_id', bizId)
            .maybeSingle(),
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

    if (planError || !plan) {
        return notFound();
    }

    const branchList = (branches ?? []) as BranchRow[];
    const serviceList = (services ?? []) as ServiceRow[];
    const row = plan as PlanRow;

    return (
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Редактирование пакета
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {row.name_ru}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                    <VisitPackagePlanForm
                        initial={{
                            id: row.id,
                            name_ru: row.name_ru,
                            name_ky: row.name_ky,
                            name_en: row.name_en,
                            visit_count: row.visit_count,
                            validity_days: row.validity_days,
                            discount_type: row.discount_type,
                            discount_value: Number(row.discount_value),
                            service_id: row.service_id,
                            branch_ids: row.branch_ids,
                            is_active: row.is_active,
                        }}
                        branches={branchList}
                        services={serviceList}
                    />
                </div>
            </div>
        </div>
    );
}
