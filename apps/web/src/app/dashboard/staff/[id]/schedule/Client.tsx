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
import { useStaffScheduleRules, type BranchSchedulePlan } from './useStaffScheduleRules';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useBusinessTimeZone } from '@/components/BusinessTimeZoneContext';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import type { BranchHoursRow } from '@/lib/scheduling/legacyDefaults';

type ClientProps = {
    bizId: string;
    staffId: string;
    branches: Branch[];
    homeBranchId: string;
    /** Home-branch hours read on the server; null when they could not be read. */
    branchHours: BranchHoursRow[] | null;
    /** The staff member already works by published schedule versions (legacy writes are refused). */
    usesPublishedSchedule?: boolean;
    /** Weekly/range rules or working_hours give days without a date rule their hours. */
    hasRegularSchedule?: boolean;
};

export default function Client(props: ClientProps) {
    if (props.usesPublishedSchedule) return <PublishedScheduleNotice />;
    return <LegacyScheduleEditor {...props} />;
}

function PublishedScheduleNotice() {
    const { t } = useLanguage();
    return (
        <AlertBanner
            variant="info"
            title={t('staff.schedule.publishedModel.title', 'График сотрудника ведётся в новой модели расписаний')}
            message={t(
                'staff.schedule.publishedModel.text',
                'Записи к сотруднику строятся по опубликованному графику. Этот редактор его не меняет; редактор публикаций появится здесь после включения новой модели расписаний.',
            )}
        />
    );
}

function LegacyScheduleEditor({
    bizId,
    staffId,
    branches,
    homeBranchId,
    branchHours,
    hasRegularSchedule = false,
}: ClientProps) {
    const tz = useBusinessTimeZone();
    const { t } = useLanguage();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'schedule' | 'transfers'>('schedule');
    const [pendingPlan, setPendingPlan] = useState<BranchSchedulePlan | null>(null);

    const {
        status,
        saving,
        currentWeekDates,
        nextWeekDates,
        rulesByDate,
        planBranchSchedule,
        applyBranchSchedule,
        saveDay,
        reload,
    } = useStaffScheduleRules({
        bizId,
        staffId,
        homeBranchId,
        branchHours,
        t,
        showError: toast.showError,
        showSuccess: toast.showSuccess,
    });

    function requestApplyBranchSchedule() {
        const plan = planBranchSchedule();
        if (!plan) return;
        if (plan.dates.length === 0) {
            toast.showInfo(t('staff.schedule.nothingToApply', 'Нечего заполнять: прошедшие дни и временные переводы не меняются'));
            return;
        }
        if (plan.overwrite > 0 || plan.keptTransfers > 0) {
            setPendingPlan(plan);
            return;
        }
        void applyBranchSchedule(plan);
    }

    return (
        <section className="space-y-4 sm:space-y-6">
            <ScheduleTabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />

            {activeTab === 'schedule' && status === 'loading' && (
                <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
                    {t('staff.schedule.loading', 'Загрузка расписания...')}
                </p>
            )}

            {activeTab === 'schedule' && status === 'error' && (
                <AlertBanner
                    variant="danger"
                    message={t('staff.schedule.loadError', 'Не удалось загрузить расписание')}
                    action={(
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="rounded-md border border-current px-2 py-1 text-xs font-medium"
                        >
                            {t('staff.schedule.retry', 'Повторить')}
                        </button>
                    )}
                />
            )}

            {activeTab === 'schedule' && status === 'ready' && (
                <>
                    <ScheduleWeekSection
                        title={t('staff.schedule.week.current', 'Текущая неделя')}
                        rangeLabel={`${formatInTimeZone(currentWeekDates[0], tz, 'dd.MM.yyyy')} — ${formatInTimeZone(currentWeekDates[6], tz, 'dd.MM.yyyy')}`}
                        dates={currentWeekDates}
                        rulesByDate={rulesByDate}
                        branches={branches}
                        homeBranchId={homeBranchId}
                        branchHours={branchHours}
                        hasRegularSchedule={hasRegularSchedule}
                        saving={saving}
                        onApplyBranchSchedule={requestApplyBranchSchedule}
                        onSaveDay={saveDay}
                        t={t}
                        showApplyButton
                    />

                    <ScheduleWeekSection
                        title={t('staff.schedule.week.next', 'Следующая неделя')}
                        rangeLabel={`${formatInTimeZone(nextWeekDates[0], tz, 'dd.MM.yyyy')} — ${formatInTimeZone(nextWeekDates[6], tz, 'dd.MM.yyyy')}`}
                        dates={nextWeekDates}
                        rulesByDate={rulesByDate}
                        branches={branches}
                        homeBranchId={homeBranchId}
                        branchHours={branchHours}
                        hasRegularSchedule={hasRegularSchedule}
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

            <ConfirmDialog
                open={pendingPlan !== null}
                onClose={() => setPendingPlan(null)}
                onConfirm={() => {
                    const plan = pendingPlan;
                    setPendingPlan(null);
                    if (plan) void applyBranchSchedule(plan);
                }}
                title={t('staff.schedule.applyBranchConfirm.title', 'Применить часы филиала?')}
                message={t(
                    'staff.schedule.applyBranchConfirm.message',
                    'Дней будет записано: {days}, из них уже сохранённых: {overwrite}. Временные переводы не изменятся: {kept}. Закрытые дни филиала станут выходными.',
                )
                    .replace('{days}', String(pendingPlan?.dates.length ?? 0))
                    .replace('{overwrite}', String(pendingPlan?.overwrite ?? 0))
                    .replace('{kept}', String(pendingPlan?.keptTransfers ?? 0))}
                confirmLabel={t('staff.schedule.applyBranch', 'Применить часы филиала')}
                cancelLabel={t('staff.schedule.applyBranchConfirm.cancel', 'Отмена')}
                isLoading={saving}
            />

            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </section>
    );
}
