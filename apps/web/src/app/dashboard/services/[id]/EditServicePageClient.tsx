'use client';

import ServiceForm from '../ServiceForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ServiceMastersEditor from '@/app/dashboard/services/[id]/ServiceMastersEditor';

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

export default function EditServicePageClient({
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

