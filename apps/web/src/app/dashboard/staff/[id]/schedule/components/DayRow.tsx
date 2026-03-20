'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';

import { SingleTimeRange } from './SingleTimeRange';
import type { Branch, TimeRange } from './scheduleTypes';

export function DayRow({
    date,
    dow,
    intervals,
    branchId,
    branches,
    homeBranchId,
    saving,
    onSave,
}: {
    date: Date;
    dow: number;
    intervals: TimeRange[] | null;
    branchId: string | null;
    branches: Branch[];
    homeBranchId: string;
    saving: boolean;
    onSave: (date: string, interval: TimeRange | null, branchId: string) => void;
}) {
    const { t } = useLanguage();
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const isPastDate = dateStr < todayStr;

    const DOW = [
        t('staff.schedule.dayOfWeek.sunday', 'Вс'),
        t('staff.schedule.dayOfWeek.monday', 'Пн'),
        t('staff.schedule.dayOfWeek.tuesday', 'Вт'),
        t('staff.schedule.dayOfWeek.wednesday', 'Ср'),
        t('staff.schedule.dayOfWeek.thursday', 'Чт'),
        t('staff.schedule.dayOfWeek.friday', 'Пт'),
        t('staff.schedule.dayOfWeek.saturday', 'Сб'),
    ];

    const isDayOffFromDb =
        intervals !== null && intervals !== undefined && Array.isArray(intervals) && intervals.length === 0;
    const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };

    const [isDayOff, setIsDayOff] = useState(isDayOffFromDb);
    const [interval, setInterval] = useState<TimeRange>(() => {
        if (intervals && intervals.length > 0 && intervals[0].start && intervals[0].end) {
            return intervals[0];
        }
        return defaultInterval;
    });
    const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || homeBranchId);

    useEffect(() => {
        const isOff = intervals !== null && intervals !== undefined && Array.isArray(intervals) && intervals.length === 0;
        setIsDayOff(isOff);
        if (intervals && Array.isArray(intervals) && intervals.length > 0 && intervals[0].start && intervals[0].end) {
            setInterval(intervals[0]);
        } else {
            setInterval(defaultInterval);
        }
        if (branchId) {
            setSelectedBranchId(branchId);
        } else {
            setSelectedBranchId(homeBranchId);
        }
    }, [intervals, branchId, homeBranchId]);

    function handleSave() {
        onSave(dateStr, isDayOff ? null : interval, selectedBranchId);
    }

    const isToday = dateStr === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

    return (
        <div
            className={`flex flex-col rounded-lg sm:rounded-xl border p-3 sm:p-4 space-y-2 sm:space-y-3 transition-all min-w-0 ${
                isPastDate
                    ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75'
                    : isToday
                      ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-sm'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700'
            }`}
        >
            <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{DOW[dow]}</span>
                        {isToday && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 whitespace-nowrap">
                                <span className="inline-flex h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-indigo-500" />
                                {t('staff.schedule.today', 'Сегодня')}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatInTimeZone(date, TZ, 'dd.MM.yyyy')}
                    </div>
                </div>
                <button
                    className="inline-flex items-center gap-1 rounded-md sm:rounded-lg border border-indigo-600 bg-indigo-600 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 whitespace-nowrap flex-shrink-0"
                    disabled={saving || isPastDate}
                    onClick={handleSave}
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="hidden sm:inline">{t('staff.schedule.saving', 'Сохранение...')}</span>
                        </>
                    ) : (
                        <>
                            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">{t('staff.schedule.save', 'Сохранить')}</span>
                        </>
                    )}
                </button>
            </div>
            <div className="space-y-2 sm:space-y-3 min-w-0">
                <label className={`flex items-center gap-2 sm:gap-2.5 min-w-0 ${isPastDate ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={isDayOff}
                        onChange={(e) => setIsDayOff(e.target.checked)}
                        disabled={saving || isPastDate}
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 flex-shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0">
                        {t('staff.schedule.dayOff', 'Выходной день')}
                    </span>
                    {isPastDate && (
                        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:inline">
                            ({t('staff.schedule.pastDateUnavailable', 'недоступно для прошедших дат')})
                        </span>
                    )}
                </label>
                {!isDayOff && (
                    <div className="min-w-0">
                        <div className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 sm:mb-2">
                            {t('staff.schedule.workingHours', 'Рабочее время')}
                        </div>
                        <SingleTimeRange
                            value={interval}
                            onChange={(v) => {
                                if (v && v.start && v.end) {
                                    setInterval(v);
                                }
                            }}
                            disabled={saving || isDayOff || isPastDate}
                        />
                    </div>
                )}
                {branches.length > 1 ? (
                    <div className="min-w-0 border-t border-gray-200 dark:border-gray-700 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                            <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {t('staff.schedule.temporaryTransfer', 'Временный перевод в филиал')}
                            </span>
                            {selectedBranchId !== homeBranchId && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 animate-pulse">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    {t('staff.schedule.active', 'Активен')}
                                </span>
                            )}
                        </div>
                        <select
                            className={`w-full rounded-md sm:rounded-lg border px-1.5 sm:px-2 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                                selectedBranchId !== homeBranchId
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-100'
                                    : 'border-gray-300 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                            }`}
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                            disabled={saving || isPastDate}
                        >
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name} {b.id === homeBranchId ? `(${t('staff.schedule.homeBranch', 'основной')})` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedBranchId !== homeBranchId && !isPastDate && (
                            <div className="mt-1.5 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                                <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                                    вњ“ {t('staff.schedule.transferHint', 'Сотрудник будет временно переведен в филиал "{branch}" на этот день').replace('{branch}', branches.find((b) => b.id === selectedBranchId)?.name || '')}
                                </p>
                            </div>
                        )}
                        {selectedBranchId === homeBranchId && !isPastDate && (
                            <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                {t('staff.schedule.selectBranchForTransfer', 'Выберите другой филиал для временного перевода на этот день')}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="min-w-0 border-t border-gray-200 dark:border-gray-700 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {t('staff.schedule.noBranchesForTransfer', 'Для временного перевода нужно добавить хотя бы один дополнительный филиал в настройках бизнеса')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
