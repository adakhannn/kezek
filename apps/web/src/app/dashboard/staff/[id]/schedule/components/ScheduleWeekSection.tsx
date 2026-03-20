'use client';

import { formatInTimeZone } from 'date-fns-tz';

import { TZ } from '@/lib/time';

import { DayRow } from './DayRow';
import type { Branch, TimeRange } from './scheduleTypes';

export function ScheduleWeekSection({
    title,
    weekDates,
    rulesByDate,
    branches,
    homeBranchId,
    saving,
    onSave,
}: {
    title: string;
    weekDates: Date[];
    rulesByDate: Map<string, { intervals: TimeRange[]; branch_id: string }>;
    branches: Branch[];
    homeBranchId: string;
    saving: boolean;
    onSave: (date: string, interval: TimeRange | null, branchId: string) => void;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{title}</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {formatInTimeZone(weekDates[0], TZ, 'dd.MM.yyyy')} - {formatInTimeZone(weekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
            </div>
            <div className="space-y-2 sm:space-y-3">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {weekDates.slice(0, 4).map((date) => {
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const ruleData = rulesByDate.get(dateStr);
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={date.getDay()}
                                intervals={ruleData ? ruleData.intervals : null}
                                branchId={ruleData?.branch_id || null}
                                branches={branches}
                                homeBranchId={homeBranchId}
                                saving={saving}
                                onSave={onSave}
                            />
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                    {weekDates.slice(4, 7).map((date) => {
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const ruleData = rulesByDate.get(dateStr);
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={date.getDay()}
                                intervals={ruleData ? ruleData.intervals : null}
                                branchId={ruleData?.branch_id || null}
                                branches={branches}
                                homeBranchId={homeBranchId}
                                saving={saving}
                                onSave={onSave}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
