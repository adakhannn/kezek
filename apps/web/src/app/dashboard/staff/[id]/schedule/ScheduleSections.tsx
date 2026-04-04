'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import type { Branch, TimeRange } from './scheduleTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Tabs } from '@/components/ui/Tabs';
import { TZ } from '@/lib/time';

function SingleTimeRange({
    value,
    onChange,
    disabled,
}: {
    value: TimeRange | null;
    onChange: (value: TimeRange | null) => void;
    disabled?: boolean;
}) {
    const start = value?.start || '09:00';
    const end = value?.end || '21:00';

    function handleStartChange(event: React.ChangeEvent<HTMLInputElement>) {
        const newStart = event.target.value;
        if (!newStart) return;

        let newEnd = end;
        if (newEnd && newStart >= newEnd) {
            const [hours, minutes] = newEnd.split(':').map(Number);
            const endDate = new Date();
            endDate.setHours(hours, minutes, 0, 0);
            endDate.setHours(endDate.getHours() + 1);
            newEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        }

        onChange({ start: newStart, end: newEnd || '21:00' });
    }

    function handleEndChange(event: React.ChangeEvent<HTMLInputElement>) {
        const newEnd = event.target.value;
        if (!newEnd) return;

        let newStart = start;
        if (newStart && newEnd <= newStart) {
            const [hours, minutes] = newStart.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            startDate.setHours(startDate.getHours() - 1);
            newStart = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        }

        onChange({ start: newStart || '09:00', end: newEnd });
    }

    return (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <input
                type="time"
                className="flex-1 min-w-0 rounded-md sm:rounded-lg border border-gray-300 bg-white px-1.5 sm:px-2 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                value={start}
                onChange={handleStartChange}
                disabled={disabled}
            />
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">вЂ”</span>
            <input
                type="time"
                className="flex-1 min-w-0 rounded-md sm:rounded-lg border border-gray-300 bg-white px-1.5 sm:px-2 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                value={end}
                onChange={handleEndChange}
                disabled={disabled}
            />
        </div>
    );
}

function DayRow({
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

    const dayNames = [
        t('staff.schedule.dayOfWeek.sunday', 'Р’СЃ'),
        t('staff.schedule.dayOfWeek.monday', 'РџРЅ'),
        t('staff.schedule.dayOfWeek.tuesday', 'Р’С‚'),
        t('staff.schedule.dayOfWeek.wednesday', 'РЎСЂ'),
        t('staff.schedule.dayOfWeek.thursday', 'Р§С‚'),
        t('staff.schedule.dayOfWeek.friday', 'РџС‚'),
        t('staff.schedule.dayOfWeek.saturday', 'РЎР±'),
    ];

    const isDayOffFromDb = intervals !== null && intervals !== undefined && Array.isArray(intervals) && intervals.length === 0;
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
        setSelectedBranchId(branchId || homeBranchId);
    }, [intervals, branchId, homeBranchId]);

    const isToday = dateStr === todayStr;

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
                        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{dayNames[dow]}</span>
                        {isToday && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 whitespace-nowrap">
                                <span className="inline-flex h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-indigo-500" />
                                {t('staff.schedule.today', 'РЎРµРіРѕРґРЅСЏ')}
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
                    onClick={() => onSave(dateStr, isDayOff ? null : interval, selectedBranchId)}
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="hidden sm:inline">{t('staff.schedule.saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ...')}</span>
                        </>
                    ) : (
                        <>
                            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">{t('staff.schedule.save', 'РЎРѕС…СЂР°РЅРёС‚СЊ')}</span>
                        </>
                    )}
                </button>
            </div>

            <div className="space-y-2 sm:space-y-3 min-w-0">
                <label className={`flex items-center gap-2 sm:gap-2.5 min-w-0 ${isPastDate ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={isDayOff}
                        onChange={(event) => setIsDayOff(event.target.checked)}
                        disabled={saving || isPastDate}
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 flex-shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0">
                        {t('staff.schedule.dayOff', 'Р’С‹С…РѕРґРЅРѕР№ РґРµРЅСЊ')}
                    </span>
                    {isPastDate && (
                        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:inline">
                            ({t('staff.schedule.pastDateUnavailable', 'РЅРµРґРѕСЃС‚СѓРїРЅРѕ РґР»СЏ РїСЂРѕС€РµРґС€РёС… РґР°С‚')})
                        </span>
                    )}
                </label>

                {!isDayOff && (
                    <div className="min-w-0">
                        <div className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 sm:mb-2">
                            {t('staff.schedule.workingHours', 'Р Р°Р±РѕС‡РµРµ РІСЂРµРјСЏ')}
                        </div>
                        <SingleTimeRange
                            value={interval}
                            onChange={(value) => {
                                if (value && value.start && value.end) {
                                    setInterval(value);
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
                                {t('staff.schedule.temporaryTransfer', 'Р’СЂРµРјРµРЅРЅС‹Р№ РїРµСЂРµРІРѕРґ РІ С„РёР»РёР°Р»')}
                            </span>
                            {selectedBranchId !== homeBranchId && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 animate-pulse">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    {t('staff.schedule.active', 'РђРєС‚РёРІРµРЅ')}
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
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                            disabled={saving || isPastDate}
                        >
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name} {branch.id === homeBranchId ? `(${t('staff.schedule.homeBranch', 'РѕСЃРЅРѕРІРЅРѕР№')})` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedBranchId !== homeBranchId && !isPastDate && (
                            <div className="mt-1.5 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                                <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                                    вњ“ {t('staff.schedule.transferHint', 'РЎРѕС‚СЂСѓРґРЅРёРє Р±СѓРґРµС‚ РІСЂРµРјРµРЅРЅРѕ РїРµСЂРµРІРµРґРµРЅ РІ С„РёР»РёР°Р» "{branch}" РЅР° СЌС‚РѕС‚ РґРµРЅСЊ').replace('{branch}', branches.find((branch) => branch.id === selectedBranchId)?.name || '')}
                                </p>
                            </div>
                        )}
                        {selectedBranchId === homeBranchId && !isPastDate && (
                            <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                {t('staff.schedule.selectBranchForTransfer', 'Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ С„РёР»РёР°Р» РґР»СЏ РІСЂРµРјРµРЅРЅРѕРіРѕ РїРµСЂРµРІРѕРґР° РЅР° СЌС‚РѕС‚ РґРµРЅСЊ')}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="min-w-0 border-t border-gray-200 dark:border-gray-700 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {t('staff.schedule.noBranchesForTransfer', 'Р”Р»СЏ РІСЂРµРјРµРЅРЅРѕРіРѕ РїРµСЂРµРІРѕРґР° РЅСѓР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ С„РёР»РёР°Р» РІ РЅР°СЃС‚СЂРѕР№РєР°С… Р±РёР·РЅРµСЃР°')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ScheduleTabs({
    activeTab,
    onTabChange,
    t,
}: {
    activeTab: 'schedule' | 'transfers';
    onTabChange: (tab: 'schedule' | 'transfers') => void;
    t: (key: string, fallback: string) => string;
}) {
    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as 'schedule' | 'transfers')}
            className="w-full sm:w-auto"
            items={[
                { key: 'schedule', label: t('staff.schedule.tab.schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ') },
                { key: 'transfers', label: t('staff.schedule.tab.transfers', 'Р’СЂРµРјРµРЅРЅС‹Рµ РїРµСЂРµРІРѕРґС‹') },
            ]}
        />
    );

}

export function ScheduleWeekSection({
    title,
    rangeLabel,
    dates,
    rulesByDate,
    branches,
    homeBranchId,
    saving,
    onApplyBranchSchedule,
    onSaveDay,
    t,
    showApplyButton,
}: {
    title: string;
    rangeLabel: string;
    dates: Date[];
    rulesByDate: Map<string, { intervals: TimeRange[]; branch_id: string }>;
    branches: Branch[];
    homeBranchId: string;
    saving: boolean;
    onApplyBranchSchedule?: () => void;
    onSaveDay: (date: string, interval: TimeRange | null, branchId: string) => void;
    t: (key: string, fallback: string) => string;
    showApplyButton?: boolean;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="mb-4 sm:mb-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{title}</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{rangeLabel}</p>
                    </div>
                    {showApplyButton && onApplyBranchSchedule && (
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
                                    <span className="hidden sm:inline">РџСЂРёРјРµРЅРµРЅРёРµ...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>РџСЂРёРјРµРЅРёС‚СЊ СЂР°СЃРїРёСЃР°РЅРёРµ С„РёР»РёР°Р»Р°</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {dates.slice(0, 4).map((date) => {
                        const dow = date.getDay();
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const ruleData = rulesByDate.get(dateStr);
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={dow}
                                intervals={ruleData !== undefined ? ruleData.intervals : null}
                                branchId={ruleData?.branch_id || null}
                                branches={branches}
                                homeBranchId={homeBranchId}
                                saving={saving}
                                onSave={onSaveDay}
                            />
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                    {dates.slice(4, 7).map((date) => {
                        const dow = date.getDay();
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const ruleData = rulesByDate.get(dateStr);
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={dow}
                                intervals={ruleData !== undefined ? ruleData.intervals : null}
                                branchId={ruleData?.branch_id || null}
                                branches={branches}
                                homeBranchId={homeBranchId}
                                saving={saving}
                                onSave={onSaveDay}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function ScheduleInstructions({ t }: { t: (key: string, fallback: string) => string }) {
    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
            <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p className="font-medium">{t('staff.schedule.instructions.title', 'РљР°Рє СЂР°Р±РѕС‚Р°РµС‚ СЂР°СЃРїРёСЃР°РЅРёРµ')}</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                        <li>{t('staff.schedule.instructions.default', 'РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РІСЃРµ РґРЅРё СЂР°Р±РѕС‡РёРµ (09:00-21:00)')}</li>
                        <li>{t('staff.schedule.instructions.dayOff', 'РћС‚РјРµС‚СЊС‚Рµ С‡РµРєР±РѕРєСЃ "Р’С‹С…РѕРґРЅРѕР№ РґРµРЅСЊ", С‡С‚РѕР±С‹ СЃРґРµР»Р°С‚СЊ РґРµРЅСЊ РЅРµСЂР°Р±РѕС‡РёРј')}</li>
                        <li>
                            <strong>{t('staff.schedule.instructions.transfer.prefix', 'Р’СЂРµРјРµРЅРЅС‹Р№ РїРµСЂРµРІРѕРґ:')}</strong>{' '}
                            {t('staff.schedule.instructions.transfer.suffix', 'Р’С‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р» РІ РІС‹РїР°РґР°СЋС‰РµРј СЃРїРёСЃРєРµ "Р¤РёР»РёР°Р»" РґР»СЏ Р»СЋР±РѕРіРѕ РґРЅСЏ, С‡С‚РѕР±С‹ РІСЂРµРјРµРЅРЅРѕ РїРµСЂРµРІРµСЃС‚Рё СЃРѕС‚СЂСѓРґРЅРёРєР° РІ РґСЂСѓРіРѕР№ С„РёР»РёР°Р». РћСЃРЅРѕРІРЅРѕР№ С„РёР»РёР°Р» РѕС‚РјРµС‡РµРЅ РєР°Рє "(РѕСЃРЅРѕРІРЅРѕР№)".')}
                        </li>
                        <li>{t('staff.schedule.instructions.weeks', 'РњРѕР¶РЅРѕ СѓРїСЂР°РІР»СЏС‚СЊ СЂР°СЃРїРёСЃР°РЅРёРµРј С‚РѕР»СЊРєРѕ РЅР° С‚РµРєСѓС‰СѓСЋ Рё СЃР»РµРґСѓСЋС‰СѓСЋ РЅРµРґРµР»СЋ')}</li>
                        <li>{t('staff.schedule.instructions.past', 'РџСЂРѕС€РµРґС€РёРµ РґР°С‚С‹ РЅРµРґРѕСЃС‚СѓРїРЅС‹ РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ')}</li>
                        <li>{t('staff.schedule.instructions.transfersTab', 'Р’СЃРµ РІСЂРµРјРµРЅРЅС‹Рµ РїРµСЂРµРІРѕРґС‹ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РІРѕ РІРєР»Р°РґРєРµ "Р’СЂРµРјРµРЅРЅС‹Рµ РїРµСЂРµРІРѕРґС‹"')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
