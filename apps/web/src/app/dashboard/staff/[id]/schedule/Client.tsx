'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';


import {
    ScheduleInstructions,
    ScheduleTabs,
    ScheduleWeekSection,
} from './ScheduleSections';
import { TransfersTab } from './TransfersTab';
import type { Branch } from './scheduleTypes';
import { useStaffScheduleRules } from './useStaffScheduleRules';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';

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

    const {
        saving,
        currentWeekDates,
        nextWeekDates,
        rulesByDate,
        applyBranchSchedule,
        saveDay,
    } = useStaffScheduleRules({
        bizId,
        staffId,
        homeBranchId,
        t,
        showError: toast.showError,
    });

    return (
        <section className="space-y-4 sm:space-y-6">
            <ScheduleTabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />

            {activeTab === 'schedule' && (
                <>
                    <ScheduleWeekSection
                        title={t('staff.schedule.week.current', 'Текущая неделя')}
                        rangeLabel={`${formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} — ${formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}`}
                        dates={currentWeekDates}
                        rulesByDate={rulesByDate}
                        branches={branches}
                        homeBranchId={homeBranchId}
                        saving={saving}
                        onApplyBranchSchedule={applyBranchSchedule}
                        onSaveDay={saveDay}
                        t={t}
                        showApplyButton
                    />

                    <ScheduleWeekSection
                        title={t('staff.schedule.week.next', 'Следующая неделя')}
                        rangeLabel={`${formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} — ${formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}`}
                        dates={nextWeekDates}
                        rulesByDate={rulesByDate}
                        branches={branches}
                        homeBranchId={homeBranchId}
                        saving={saving}
                        onSaveDay={saveDay}
                        t={t}
                    />

                    <ScheduleInstructions t={t} />
                </>
            )}

            {activeTab === 'transfers' && (
                <TransfersTab
                    bizId={bizId}
                    staffId={staffId}
                    branches={branches}
                    homeBranchId={homeBranchId}
                />
            )}
        </section>
    );
}
