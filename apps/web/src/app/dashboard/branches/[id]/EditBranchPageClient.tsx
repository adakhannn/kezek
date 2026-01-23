'use client';

import BranchForm from '../BranchForm';
import DeleteBranchButton from '../DeleteBranchButton';

import BranchPromotionsPanel from './BranchPromotionsPanel';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BranchScheduleEditor } from '@/components/admin/branches/BranchScheduleEditor';


type BranchSchedule = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

export default function EditBranchPageClient({ 
    branch, 
    isSuperAdmin,
    initialSchedule = [],
    bizId,
    bizSlug,
}: { 
    branch: { 
        id: string; 
        name: string; 
        address: string | null; 
        is_active: boolean; 
        lat: number | null; 
        lon: number | null; 
    }; 
    isSuperAdmin: boolean;
    initialSchedule?: BranchSchedule[];
    bizId: string;
    bizSlug: string;
}) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {t('branches.edit.title', 'Редактирование филиала')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    {t('branches.edit.subtitle', 'Управление данными филиала')}
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchForm
                    initial={{
                        id: String(branch.id),
                        name: String(branch.name),
                        address: (branch.address ?? null),
                        is_active: !!branch.is_active,
                        lat: branch.lat ?? null,
                        lon: branch.lon ?? null,
                    }}
                    apiBase="/api/branches"
                />
            </div>

            {/* Расписание филиала */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchScheduleEditor 
                    bizId={bizId}
                    branchId={String(branch.id)}
                    initialSchedule={initialSchedule}
                    apiBase="/api/branches"
                />
            </div>

            {/* Акции филиала */}
            <BranchPromotionsPanel branchId={String(branch.id)} bizSlug={bizSlug} />

            {/* Временно скрыто */}
            {/* <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchAdminsPanel branchId={String(branch.id)} />
            </div> */}

            {/* Опасная зона - только для суперадмина */}
            {isSuperAdmin && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg space-y-4">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">
                            {t('branches.danger.title', 'Опасная зона')}
                        </h3>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                        {t('branches.danger.desc', 'Удаление филиала невозможно, если к нему привязаны сотрудники, услуги или брони. Сначала необходимо удалить или переместить все связанные данные.')}
                    </p>
                    <DeleteBranchButton id={String(branch.id)} />
                </div>
            )}
        </main>
    );
}

