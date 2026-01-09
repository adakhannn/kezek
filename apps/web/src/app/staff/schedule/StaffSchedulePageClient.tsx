'use client';

import ViewSchedule from './ViewSchedule';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function StaffSchedulePageClient({
    bizId,
    staffId,
    branches,
    homeBranchId,
}: {
    bizId: string;
    staffId: string;
    branches: { id: string; name: string }[];
    homeBranchId: string;
}) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('staff.schedule.title', 'Моё расписание')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    {t('staff.schedule.subtitle', 'Просмотр вашего рабочего расписания')}
                </p>
            </div>

            <ViewSchedule
                bizId={bizId}
                staffId={staffId}
                branches={branches}
                homeBranchId={homeBranchId}
            />
        </main>
    );
}

