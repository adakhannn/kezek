'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type StaffSchedulePageClientProps = {
    staffId: string;
    staffName: string;
    bizName?: string | null;
    bizCity?: string | null;
};

export default function StaffSchedulePageClient({
    staffId,
    staffName,
    bizName,
    bizCity,
}: StaffSchedulePageClientProps) {
    const { t } = useLanguage();

    const displayBizName = bizName || t('staff.schedule.biz.defaultName', 'Ваш бизнес в Kezek');

    return (
        <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
            <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <Link
                                href={`/dashboard/staff/${staffId}`}
                                className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                                title={t('staff.schedule.back', 'Назад к карточке сотрудника')}
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">
                                    {t('staff.schedule.title', 'Расписание')}
                                </h1>
                                <p className="text-xs sm:text-sm lg:text-base text-indigo-100/90 mt-0.5 sm:mt-1 truncate">
                                    {staffName}
                                </p>
                                <p className="text-[11px] sm:text-xs text-indigo-100/80 mt-0.5 truncate">
                                    {t('staff.schedule.biz.context', 'Бизнес')}: {displayBizName}
                                    {bizCity ? ` · ${bizCity}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

