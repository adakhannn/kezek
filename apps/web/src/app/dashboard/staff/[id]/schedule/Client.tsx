'use client';

import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

import { getWeekDates } from './components/scheduleWeek';
import { ScheduleTabContent } from './components/ScheduleTabContent';
import type { Branch } from './components/scheduleTypes';
import { TransfersTabContent } from './components/TransfersTabContent';
import { useScheduleRules } from './hooks/useScheduleRules';
import { useScheduleTransfers } from './hooks/useScheduleTransfers';

export default function Client({
    bizId,
    staffId,
    branches,
    homeBranchId,
}: {
    bizId: string;
    staffId: string;
    branches: Branch[];
    homeBranchId: string;
}) {
    const { t } = useLanguage();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'schedule' | 'transfers'>('schedule');
    const currentWeekDates = useMemo(() => getWeekDates(0), []);
    const nextWeekDates = useMemo(() => getWeekDates(1), []);

    const { rulesByDate, saving, applyBranchSchedule, saveDay } = useScheduleRules({
        bizId,
        staffId,
        homeBranchId,
        currentWeekDates,
        nextWeekDates,
        t,
        toast,
    });

    const { transfers, loading } = useScheduleTransfers({
        bizId,
        staffId,
        homeBranchId,
        branches,
        t,
    });

    const homeBranch = branches.find((branch) => branch.id === homeBranchId);
    const homeBranchName = homeBranch?.name || t('staff.schedule.transfers.homeBranchDefault', 'Основной филиал');

    return (
        <section className="space-y-4 sm:space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`whitespace-nowrap border-b-2 py-2 sm:py-4 px-1 text-sm sm:text-base font-medium transition-colors ${
                            activeTab === 'schedule'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        {t('staff.schedule.tab.schedule', 'Расписание')}
                    </button>
                    <button
                        onClick={() => setActiveTab('transfers')}
                        className={`whitespace-nowrap border-b-2 py-2 sm:py-4 px-1 text-sm sm:text-base font-medium transition-colors ${
                            activeTab === 'transfers'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        {t('staff.schedule.tab.transfers', 'Временные переводы')}
                    </button>
                </nav>
            </div>

            {activeTab === 'schedule' ? (
                <ScheduleTabContent
                    t={t}
                    currentWeekDates={currentWeekDates}
                    nextWeekDates={nextWeekDates}
                    rulesByDate={rulesByDate}
                    branches={branches}
                    homeBranchId={homeBranchId}
                    saving={saving}
                    onApplyBranchSchedule={applyBranchSchedule}
                    onSaveDay={saveDay}
                />
            ) : (
                <TransfersTabContent
                    t={t}
                    loading={loading}
                    transfers={transfers}
                    homeBranchName={homeBranchName}
                />
            )}

            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </section>
    );
}
