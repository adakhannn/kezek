import { notFound } from 'next/navigation';

import ServiceForm from '../ServiceForm';

import ServiceMastersEditor from "@/app/dashboard/services/[id]/ServiceMastersEditor";
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditServicePage(context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    const { supabase, bizId } = await getBizContextForManagers();

    const [{ data: svc }, { data: branches }] = await Promise.all([
        supabase
            .from('services')
            .select('id,name_ru,duration_min,price_from,price_to,active,branch_id,biz_id')
            .eq('id', params.id)
            .maybeSingle(),
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    if (!svc || String(svc.biz_id) !== String(bizId)) return notFound();

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Редактирование услуги</h1>
                    <p className="text-gray-600 dark:text-gray-400">Управление данными услуги</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <ServiceForm
                    initial={{
                        id: String(svc.id),
                        name_ru: String(svc.name_ru),
                        duration_min: Number(svc.duration_min),
                        price_from: Number(svc.price_from),
                        price_to: Number(svc.price_to),
                        active: !!svc.active,
                        branch_id: String(svc.branch_id),
                    }}
                    branches={branches || []}
                    apiBase="/api/services"
                />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <ServiceMastersEditor
                    serviceId={String(svc.id)}
                    serviceBranchId={String(svc.branch_id)}
                />
            </div>
        </div>
    );
}
