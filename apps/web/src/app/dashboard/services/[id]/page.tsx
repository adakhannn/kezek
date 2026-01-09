import { notFound } from 'next/navigation';

import ServiceForm from '../ServiceForm';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ServiceMastersEditor from '@/app/dashboard/services/[id]/ServiceMastersEditor';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditServicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { bizId } = await getBizContextForManagers();
    // Используем service client для обхода RLS, т.к. доступ уже проверен через getBizContextForManagers
    const admin = getServiceClient();

    const [{ data: svc, error: svcError }, { data: branches, error: branchesError }] = await Promise.all([
        admin
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id,biz_id')
            .eq('id', id)
            .maybeSingle(),
        admin
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    // Логируем ошибки для отладки
    if (svcError) {
        console.error('[EditServicePage] Error loading service:', svcError);
        return notFound();
    }

    if (branchesError) {
        console.error('[EditServicePage] Error loading branches:', branchesError);
        // Не возвращаем 404, т.к. это не критично
    }

    // Проверяем, найдена ли услуга
    if (!svc) {
        console.error('[EditServicePage] Service not found:', id);
        return notFound();
    }

    // Проверяем, принадлежит ли услуга текущему бизнесу
    if (String(svc.biz_id) !== String(bizId)) {
        console.error('[EditServicePage] Service belongs to different business:', {
            serviceBizId: svc.biz_id,
            currentBizId: bizId,
            serviceId: id,
        });
        return notFound();
    }

    // Находим все активные услуги с таким же названием в этом бизнесе (это "копии" услуги в разных филиалах)
    // Неактивные услуги (мягко удаленные) не должны показываться
    const { data: allServiceBranches } = await admin
        .from('services')
        .select('branch_id')
        .eq('biz_id', bizId)
        .eq('name_ru', svc.name_ru)
        .eq('active', true); // Только активные услуги

    // Получаем список ID филиалов, где есть эта услуга
    const serviceBranchIds = new Set(
        (allServiceBranches ?? []).map((s: { branch_id: string }) => s.branch_id),
    );

    return (
        <LanguageProvider>
            <EditServicePageInner
                svc={{
                    id: String(svc.id),
                    name_ru: String(svc.name_ru),
                    name_ky: svc.name_ky || null,
                    name_en: svc.name_en || null,
                    duration_min: Number(svc.duration_min),
                    price_from: Number(svc.price_from),
                    price_to: Number(svc.price_to),
                    active: !!svc.active,
                    branch_id: String(svc.branch_id),
                }}
                branches={branches || []}
                serviceBranchIds={Array.from(serviceBranchIds)}
            />
        </LanguageProvider>
    );
}

type SvcForClient = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_id: string;
};

function EditServicePageInner({
    svc,
    branches,
    serviceBranchIds,
}: {
    svc: SvcForClient;
    branches: { id: string; name: string }[];
    serviceBranchIds: string[];
}) {
    const { t } = useLanguage();

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {t('services.edit.title', 'Редактирование услуги')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {t('services.edit.subtitle', 'Управление данными услуги')}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <ServiceForm
                    initial={{
                        id: svc.id,
                        name_ru: svc.name_ru,
                        name_ky: svc.name_ky,
                        name_en: svc.name_en,
                        duration_min: svc.duration_min,
                        price_from: svc.price_from,
                        price_to: svc.price_to,
                        active: svc.active,
                        branch_id: svc.branch_id,
                        branch_ids: serviceBranchIds,
                    }}
                    branches={branches}
                    apiBase="/api/services"
                />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {t('services.masters.title', 'Кто выполняет эту услугу')}
                </h2>
                <ServiceMastersEditor
                    serviceId={svc.id}
                    serviceBranchId={svc.branch_id}
                />
            </div>
        </div>
    );
}
