'use client';

import { startOfWeek, addDays, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

type Branch = { id: string; name: string };
type TimeRange = { start: string; end: string };

// Получаем даты текущей и следующей недели
function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Понедельник
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(targetWeekStart, i));
}

// Компонент для одного интервала времени
function SingleTimeRange({
    value,
    onChange,
    disabled,
}: {
    value: TimeRange | null;
    onChange: (v: TimeRange | null) => void;
    disabled?: boolean;
}) {
    const start = value?.start || '09:00';
    const end = value?.end || '21:00';

    function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newStart = e.target.value;
        if (!newStart) return;
        
        // Если новое время начала >= времени окончания, увеличиваем время окончания на час
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

    function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newEnd = e.target.value;
        if (!newEnd) return;
        
        // Если новое время окончания <= времени начала, уменьшаем время начала на час
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
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">—</span>
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

// Компонент для дня недели
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
    // Проверяем, является ли дата прошедшей (сравниваем только дату, без времени)
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
    
    // Если правила нет в БД или интервалы пустые - день выходной
    // Если правила нет - день рабочий по умолчанию
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
        // Если правила нет (null) - день рабочий по умолчанию
        // Если правило есть, но интервалы пустые или null - день выходной
        const isOff = intervals !== null && intervals !== undefined && Array.isArray(intervals) && intervals.length === 0;
        setIsDayOff(isOff);
        if (intervals && Array.isArray(intervals) && intervals.length > 0 && intervals[0].start && intervals[0].end) {
            setInterval(intervals[0]);
        } else {
            setInterval(defaultInterval);
        }
        // Обновляем выбранный филиал
        if (branchId) {
            setSelectedBranchId(branchId);
        } else {
            setSelectedBranchId(homeBranchId);
        }
    }, [intervals, branchId, homeBranchId]);

    function handleDayOffChange(e: React.ChangeEvent<HTMLInputElement>) {
        setIsDayOff(e.target.checked);
    }

    function handleSave() {
        // Если день выходной, передаем null (будет сохранено с пустыми интервалами)
        // Если день рабочий, передаем интервал
        onSave(dateStr, isDayOff ? null : interval, selectedBranchId);
    }

    const isToday = dateStr === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    
    return (
        <div className={`flex flex-col rounded-lg sm:rounded-xl border p-3 sm:p-4 space-y-2 sm:space-y-3 transition-all min-w-0 ${
            isPastDate 
                ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75' 
                : isToday
                ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-sm'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700'
        }`}>
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
                        onChange={handleDayOffChange}
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
                                    ✓ {t('staff.schedule.transferHint', 'Сотрудник будет временно переведен в филиал "{branch}" на этот день').replace('{branch}', branches.find(b => b.id === selectedBranchId)?.name || '')}
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
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<
        Array<{
            id: string;
            date_on: string;
            intervals: TimeRange[];
            branch_id: string;
        }>
    >([]);

    // Получаем даты текущей и следующей недели
    const currentWeekDates = useMemo(() => getWeekDates(0), []);
    const nextWeekDates = useMemo(() => getWeekDates(1), []);

    // Загружаем правила для текущей и следующей недели
    useEffect(() => {
        let ignore = false;
        (async () => {
            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, intervals, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            if (ignore) return;
            const loadedRules = (data ?? []).map((r) => ({
                id: r.id,
                date_on: r.date_on,
                intervals: (r.intervals ?? []) as TimeRange[],
                branch_id: r.branch_id || homeBranchId,
            }));
            setRules(loadedRules);

            // Автоматически создаем правила для дней, где их нет (рабочие дни по умолчанию)
            const allDates = [
                ...currentWeekDates.map((d) => formatInTimeZone(d, TZ, 'yyyy-MM-dd')),
                ...nextWeekDates.map((d) => formatInTimeZone(d, TZ, 'yyyy-MM-dd')),
            ];
            const existingDates = new Set(loadedRules.map((r) => r.date_on));
            const missingDates = allDates.filter((d) => !existingDates.has(d));

            if (missingDates.length > 0) {
                // Загружаем расписание филиала
                const { data: branchSchedule } = await supabase
                    .from('branch_working_hours')
                    .select('day_of_week, intervals')
                    .eq('biz_id', bizId)
                    .eq('branch_id', homeBranchId);

                // Создаем карту расписания филиала по дням недели
                const branchScheduleMap = new Map<number, TimeRange[]>();
                (branchSchedule || []).forEach((s) => {
                    const intervals = (s.intervals || []) as TimeRange[];
                    if (intervals.length > 0) {
                        branchScheduleMap.set(s.day_of_week, intervals);
                    }
                });

                // Создаем правила для отсутствующих дней, используя расписание филиала
                const inserts = missingDates.map((date) => {
                    // Определяем день недели (0 = воскресенье, 1 = понедельник, ..., 6 = суббота)
                    const dateObj = new Date(date + 'T12:00:00');
                    const dayOfWeek = dateObj.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота

                    // Получаем расписание филиала для этого дня недели
                    const branchIntervals = branchScheduleMap.get(dayOfWeek);
                    const defaultInterval: TimeRange = branchIntervals && branchIntervals.length > 0
                        ? branchIntervals[0] // Используем первый интервал из расписания филиала
                        : { start: '09:00', end: '21:00' }; // Fallback, если расписание не задано

                    return {
                        biz_id: bizId,
                        staff_id: staffId,
                        kind: 'date' as const,
                        date_on: date,
                        branch_id: homeBranchId,
                        tz: TZ,
                        intervals: branchIntervals && branchIntervals.length > 0 ? branchIntervals : [defaultInterval],
                        breaks: [],
                        is_active: true,
                        priority: 0,
                    };
                });

                // Вставляем все отсутствующие правила
                await supabase.from('staff_schedule_rules').insert(inserts);

                // Перезагружаем правила
                const { data: reloadedData } = await supabase
                    .from('staff_schedule_rules')
                    .select('id, date_on, intervals, branch_id')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('kind', 'date')
                    .eq('is_active', true)
                    .gte('date_on', weekStart)
                    .lt('date_on', weekEnd)
                    .order('date_on', { ascending: true });

                if (!ignore) {
                    setRules(
                        (reloadedData ?? []).map((r) => ({
                            id: r.id,
                            date_on: r.date_on,
                            intervals: (r.intervals ?? []) as TimeRange[],
                            branch_id: r.branch_id || homeBranchId,
                        }))
                    );
                }
            }
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, staffId, homeBranchId, currentWeekDates, nextWeekDates]);

    // Создаем карту правил по датам
    const rulesByDate = useMemo(() => {
        const map = new Map<string, { intervals: TimeRange[]; branch_id: string }>();
        for (const r of rules) {
            map.set(r.date_on, { intervals: r.intervals, branch_id: r.branch_id });
        }
        return map;
    }, [rules]);

    async function applyBranchSchedule() {
        setSaving(true);
        try {
            // Загружаем расписание филиала
            const { data: branchSchedule } = await supabase
                .from('branch_working_hours')
                .select('day_of_week, intervals')
                .eq('biz_id', bizId)
                .eq('branch_id', homeBranchId);

            // Создаем карту расписания филиала по дням недели
            const branchScheduleMap = new Map<number, TimeRange[]>();
            (branchSchedule || []).forEach((s) => {
                const intervals = (s.intervals || []) as TimeRange[];
                if (intervals.length > 0) {
                    branchScheduleMap.set(s.day_of_week, intervals);
                }
            });

            // Получаем все даты текущей и следующей недели
            const allDates = [
                ...currentWeekDates.map((d) => formatInTimeZone(d, TZ, 'yyyy-MM-dd')),
                ...nextWeekDates.map((d) => formatInTimeZone(d, TZ, 'yyyy-MM-dd')),
            ];

            // Обновляем или создаем правила для всех дней
            const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };
            
            for (const date of allDates) {
                const dateObj = new Date(date + 'T12:00:00');
                const dayOfWeek = dateObj.getDay();
                
                // Получаем расписание филиала для этого дня недели
                const branchIntervals = branchScheduleMap.get(dayOfWeek);
                const intervals = branchIntervals && branchIntervals.length > 0
                    ? branchIntervals
                    : [defaultInterval];

                // Проверяем, есть ли уже правило для этой даты
                const existing = rules.find((r) => r.date_on === date);

                if (existing?.id) {
                    // Обновляем существующее правило
                    await supabase
                        .from('staff_schedule_rules')
                        .update({
                            intervals,
                            breaks: [],
                            branch_id: homeBranchId,
                            is_active: true,
                        })
                        .eq('id', existing.id)
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId);
                } else {
                    // Создаем новое правило
                    await supabase.from('staff_schedule_rules').insert({
                        biz_id: bizId,
                        staff_id: staffId,
                        kind: 'date',
                        date_on: date,
                        branch_id: homeBranchId,
                        tz: TZ,
                        intervals,
                        breaks: [],
                        is_active: true,
                        priority: 0,
                    });
                }
            }

            // Перезагружаем правила
            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');
            
            const { data: reloadedData } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, intervals, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            setRules(
                (reloadedData ?? []).map((r) => ({
                    id: r.id,
                    date_on: r.date_on,
                    intervals: (r.intervals ?? []) as TimeRange[],
                    branch_id: r.branch_id || homeBranchId,
                }))
            );
        } catch (e) {
            logError('StaffScheduleClient', 'Error applying branch schedule', e);
            toast.showError(t('staff.schedule.applyBranchError', 'Ошибка при применении расписания филиала:') + ' ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    }

    async function saveDay(date: string, interval: TimeRange | null, branchId: string) {
        setSaving(true);
        try {
            const existing = rules.find((r) => r.date_on === date);

            // Если interval === null, значит день выходной - сохраняем с пустыми интервалами
            // Если interval есть, значит день рабочий - сохраняем с интервалом
            const intervalsToSave = interval ? [interval] : [];

            // Если филиал отличается от основного - это временный перевод
            const isTemporaryTransfer = branchId !== homeBranchId;

            if (existing?.id) {
                // Обновляем существующее правило
                await supabase
                    .from('staff_schedule_rules')
                    .update({
                        intervals: intervalsToSave,
                        breaks: [],
                        branch_id: branchId,
                        is_active: true,
                    })
                    .eq('id', existing.id)
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId);

                // Если это временный перевод, создаем или обновляем запись в staff_branch_assignments
                if (isTemporaryTransfer) {
                    // Проверяем, есть ли уже запись для этой даты
                    const { data: existingAssign } = await supabase
                        .from('staff_branch_assignments')
                        .select('id')
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('branch_id', branchId)
                        .eq('valid_from', date)
                        .eq('valid_to', date)
                        .maybeSingle();

                    if (!existingAssign) {
                        // Создаем временное назначение только на этот день
                        await supabase.from('staff_branch_assignments').insert({
                            biz_id: bizId,
                            staff_id: staffId,
                            branch_id: branchId,
                            valid_from: date,
                            valid_to: date,
                        });
                    }
                } else if (existing.branch_id !== homeBranchId) {
                    // Если филиал вернулся к основному, удаляем временное назначение для этой даты
                    await supabase
                        .from('staff_branch_assignments')
                        .delete()
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('branch_id', existing.branch_id)
                        .eq('valid_from', date)
                        .eq('valid_to', date);
                }
            } else {
                // Создаем новое правило (даже для выходного дня, чтобы пометить его явно)
                await supabase.from('staff_schedule_rules').insert({
                    biz_id: bizId,
                    staff_id: staffId,
                    kind: 'date',
                    date_on: date,
                    branch_id: branchId,
                    tz: TZ,
                    intervals: intervalsToSave,
                    breaks: [],
                    is_active: true,
                    priority: 0,
                });

                // Если это временный перевод, создаем запись в staff_branch_assignments
                if (isTemporaryTransfer) {
                    await supabase.from('staff_branch_assignments').insert({
                        biz_id: bizId,
                        staff_id: staffId,
                        branch_id: branchId,
                        valid_from: date,
                        valid_to: date,
                    });
                }
            }

            // Перезагружаем правила
            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, intervals, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            setRules(
                (data ?? []).map((r) => ({
                    id: r.id,
                    date_on: r.date_on,
                    intervals: (r.intervals ?? []) as TimeRange[],
                    branch_id: r.branch_id || homeBranchId,
                }))
            );
        } catch (error) {
            logError('StaffScheduleClient', 'Error saving schedule', error);
            toast.showError(t('staff.schedule.saveError', 'Ошибка при сохранении расписания'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-4 sm:space-y-6">
            {/* Вкладки */}
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

            {activeTab === 'schedule' && (
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
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                {formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                                {formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}
                            </p>
                        </div>
                        <button
                            onClick={applyBranchSchedule}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:text-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-800 dark:hover:bg-indigo-900/30"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="hidden sm:inline">Применение...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Применить расписание филиала</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                    {/* Первая строка: 4 карточки */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        {currentWeekDates.slice(0, 4).map((date) => {
                            const dow = date.getDay(); // 0-6 (0=воскресенье)
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
                                    onSave={saveDay}
                                />
                            );
                        })}
                    </div>
                    {/* Вторая строка: 3 карточки */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                        {currentWeekDates.slice(4, 7).map((date) => {
                            const dow = date.getDay(); // 0-6 (0=воскресенье)
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
                                    onSave={saveDay}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{t('staff.schedule.week.next', 'Следующая неделя')}</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                        {formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}
                    </p>
                </div>
                <div className="space-y-2 sm:space-y-3">
                    {/* Первая строка: 4 карточки */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                        {nextWeekDates.slice(0, 4).map((date) => {
                            const dow = date.getDay(); // 0-6 (0=воскресенье)
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
                                    onSave={saveDay}
                                />
                            );
                        })}
                    </div>
                    {/* Вторая строка: 3 карточки */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                        {nextWeekDates.slice(4, 7).map((date) => {
                            const dow = date.getDay(); // 0-6 (0=воскресенье)
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
                                    onSave={saveDay}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

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

// Компонент для вкладки временных переводов
function TransfersTab({
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
    const [transfers, setTransfers] = useState<
        Array<{
            id: string;
            date_on: string;
            branch_id: string;
            branch_name: string;
        }>
    >([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            const weekStart = formatInTimeZone(getWeekDates(0)[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(getWeekDates(1)[6], 1), TZ, 'yyyy-MM-dd');

            // Загружаем правила расписания с филиалами, которые отличаются от основного
            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .neq('branch_id', homeBranchId)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            if (ignore) return;

            const transfersData = (data ?? [])
                .map((r) => {
                    const branch = branches.find((b) => b.id === r.branch_id);
                    return {
                        id: r.id,
                        date_on: r.date_on,
                        branch_id: r.branch_id,
                        branch_name: branch?.name || t('staff.schedule.transfers.unknownBranch', 'Неизвестный филиал'),
                    };
                })
                .filter((transfer) => transfer.branch_name !== t('staff.schedule.transfers.unknownBranch', 'Неизвестный филиал'));

            setTransfers(transfersData);
            setLoading(false);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, staffId, homeBranchId, branches]);

    const homeBranch = branches.find((b) => b.id === homeBranchId);
    const homeBranchName = homeBranch?.name || t('staff.schedule.transfers.homeBranchDefault', 'Основной филиал');

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('staff.schedule.transfers.loading', 'Загрузка переводов...')}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>{t('staff.schedule.transfers.title', 'Временные переводы')}</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {t('staff.schedule.transfers.subtitle', 'Список дней, когда сотрудник временно переведен на другой филиал')}
                    </p>
            </div>

            {transfers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">
                        {t('staff.schedule.transfers.empty.title', 'Нет временных переводов')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('staff.schedule.transfers.empty.desc', 'Временные переводы настраиваются в разделе «Расписание» при выборе филиала для дня')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                        <p className="text-xs sm:text-sm text-indigo-800 dark:text-indigo-200">
                            <span className="font-medium">{t('staff.schedule.transfers.homeBranch', 'Основной филиал:')}</span> {homeBranchName}
                        </p>
                    </div>
                    <div className="space-y-2">
                        {transfers.map((transfer) => {
                            const date = new Date(transfer.date_on + 'T12:00:00');
                            const isToday = formatInTimeZone(date, TZ, 'yyyy-MM-dd') === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
                            const isPast = formatInTimeZone(date, TZ, 'yyyy-MM-dd') < formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
                            
                            return (
                                <div
                                    key={transfer.id}
                                    className={`flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all ${
                                        isToday
                                            ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-sm'
                                            : isPast
                                            ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75'
                                            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                                                {formatInTimeZone(date, TZ, 'dd.MM.yyyy')}
                                            </span>
                                            {isToday && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 whitespace-nowrap">
                                                    <span className="inline-flex h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-indigo-500" />
                                                    {t('staff.schedule.today', 'Сегодня')}
                                                </span>
                                            )}
                                            {isPast && (
                                                <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                    {t('staff.schedule.transfers.past', 'Прошлое')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="truncate">{transfer.branch_name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="hidden sm:inline">{t('staff.schedule.transfers.transferred', 'Переведен')}</span>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p className="font-medium">{t('staff.schedule.transfers.instructions.title', 'Как работают временные переводы')}</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                            <li>{t('staff.schedule.transfers.instructions.setup', 'Временные переводы настраиваются в разделе «Расписание»')}</li>
                            <li>{t('staff.schedule.transfers.instructions.select', 'Выберите филиал для конкретного дня при редактировании расписания')}</li>
                            <li>{t('staff.schedule.transfers.instructions.oneDay', 'Перевод действует только на выбранный день')}</li>
                            <li>{t('staff.schedule.transfers.instructions.otherDays', 'В остальные дни сотрудник работает в основном филиале')}</li>
                        </ul>
                    </div>
                </div>
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
