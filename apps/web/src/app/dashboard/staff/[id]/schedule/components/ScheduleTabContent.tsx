'use client';

import type { Branch, TimeRange } from './scheduleTypes';
import { ScheduleWeekSection } from './ScheduleWeekSection';

export function ScheduleTabContent({
    t,
    currentWeekDates,
    nextWeekDates,
    rulesByDate,
    branches,
    homeBranchId,
    saving,
    onApplyBranchSchedule,
    onSaveDay,
}: {
    t: (key: string, fallback?: string) => string;
    currentWeekDates: Date[];
    nextWeekDates: Date[];
    rulesByDate: Map<string, { intervals: TimeRange[]; branch_id: string }>;
    branches: Branch[];
    homeBranchId: string;
    saving: boolean;
    onApplyBranchSchedule: () => void | Promise<void>;
    onSaveDay: (date: string, interval: TimeRange | null, branchId: string) => void | Promise<void>;
}) {
    return (
        <>
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-4 sm:mb-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{t('staff.schedule.week.current', 'Текущая неделя')}</span>
                            </h2>
                        </div>
                        <button
                            onClick={onApplyBranchSchedule}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:text-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-800 dark:hover:bg-indigo-900/30"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('staff.schedule.applying', 'Применение...')}</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>{t('staff.schedule.applyBranchSchedule', 'Применить расписание филиала')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                <ScheduleWeekSection
                    title={t('staff.schedule.week.current', 'Текущая неделя')}
                    weekDates={currentWeekDates}
                    rulesByDate={rulesByDate}
                    branches={branches}
                    homeBranchId={homeBranchId}
                    saving={saving}
                    onSave={onSaveDay}
                />
            </div>

            <ScheduleWeekSection
                title={t('staff.schedule.week.next', 'Следующая неделя')}
                weekDates={nextWeekDates}
                rulesByDate={rulesByDate}
                branches={branches}
                homeBranchId={homeBranchId}
                saving={saving}
                onSave={onSaveDay}
            />

            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p className="font-medium">{t('staff.schedule.instructions.title', 'Как работает расписание')}</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                            <li>{t('staff.schedule.instructions.default', 'По умолчанию все дни рабочие (09:00-21:00)')}</li>
                            <li>{t('staff.schedule.instructions.dayOff', 'Отметьте чекбокс "Выходной день", чтобы сделать день нерабочим')}</li>
                            <li>
                                <strong>{t('staff.schedule.instructions.transfer.prefix', 'Временный перевод:')}</strong>{' '}
                                {t('staff.schedule.instructions.transfer.suffix', 'Выберите филиал в выпадающем списке "Филиал" для любого дня, чтобы временно перевести сотрудника в другой филиал. Основной филиал отмечен как "(основной)".')}
                            </li>
                            <li>{t('staff.schedule.instructions.weeks', 'Можно управлять расписанием только на текущую и следующую неделю')}</li>
                            <li>{t('staff.schedule.instructions.past', 'Прошедшие даты недоступны для редактирования')}</li>
                            <li>{t('staff.schedule.instructions.transfersTab', 'Все временные переводы отображаются во вкладке "Временные переводы"')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
