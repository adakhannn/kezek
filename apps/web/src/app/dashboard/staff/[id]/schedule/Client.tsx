'use client';

import { startOfWeek, addDays, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

type Branch = { id: string; name: string };
type TimeRange = { start: string; end: string };

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
        <div className="flex items-center gap-2">
            <input
                type="time"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                value={start}
                onChange={handleStartChange}
                disabled={disabled}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
            <input
                type="time"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
    saving,
    onSave,
}: {
    date: Date;
    dow: number;
    intervals: TimeRange[] | null;
    saving: boolean;
    onSave: (date: string, interval: TimeRange | null) => void;
}) {
    const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
    // Проверяем, является ли дата прошедшей (сравниваем только дату, без времени)
    const todayStr = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const isPastDate = dateStr < todayStr;
    
    // Если правила нет в БД или интервалы пустые - день выходной
    // Если правила нет - день рабочий по умолчанию
    const isDayOffFromDb = intervals !== null && intervals !== undefined && intervals.length === 0;
    const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };
    
    const [isDayOff, setIsDayOff] = useState(isDayOffFromDb);
    const [interval, setInterval] = useState<TimeRange>(() => {
        if (intervals && intervals.length > 0 && intervals[0].start && intervals[0].end) {
            return intervals[0];
        }
        return defaultInterval;
    });

    useEffect(() => {
        // Если правила нет (null) - день рабочий по умолчанию
        // Если правило есть, но интервалы пустые - день выходной
        const isOff = intervals !== null && intervals !== undefined && intervals.length === 0;
        setIsDayOff(isOff);
        if (intervals && intervals.length > 0 && intervals[0].start && intervals[0].end) {
            setInterval(intervals[0]);
        } else {
            setInterval(defaultInterval);
        }
    }, [intervals]);

    function handleDayOffChange(e: React.ChangeEvent<HTMLInputElement>) {
        setIsDayOff(e.target.checked);
    }

    function handleSave() {
        // Если день выходной, передаем null (будет сохранено с пустыми интервалами)
        // Если день рабочий, передаем интервал
        onSave(dateStr, isDayOff ? null : interval);
    }

    const isToday = dateStr === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    
    return (
        <div className={`rounded-xl border p-4 space-y-3 transition-all ${
            isPastDate 
                ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75' 
                : isToday
                ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-sm'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700'
        }`}>
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{DOW[dow]}</span>
                        {isToday && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                Сегодня
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatInTimeZone(date, TZ, 'dd.MM.yyyy')}
                    </div>
                </div>
                <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 whitespace-nowrap"
                    disabled={saving || isPastDate}
                    onClick={handleSave}
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Сохранение...</span>
                        </>
                    ) : (
                        <>
                            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Сохранить</span>
                        </>
                    )}
                </button>
            </div>
            <div className="space-y-3">
                <label className={`flex items-center gap-2.5 ${isPastDate ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={isDayOff}
                        onChange={handleDayOffChange}
                        disabled={saving || isPastDate}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Выходной день
                    </span>
                    {isPastDate && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">(недоступно для прошедших дат)</span>
                    )}
                </label>
                {!isDayOff && (
                    <div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Рабочее время</div>
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
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<
        Array<{
            id: string;
            date_on: string;
            intervals: TimeRange[];
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
                .select('id, date_on, intervals')
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
                // Создаем правила для отсутствующих дней с дефолтным расписанием
                const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };
                const inserts = missingDates.map((date) => ({
                    biz_id: bizId,
                    staff_id: staffId,
                    kind: 'date' as const,
                    date_on: date,
                    branch_id: homeBranchId,
                    tz: TZ,
                    intervals: [defaultInterval],
                    breaks: [],
                    is_active: true,
                    priority: 0,
                }));

                // Вставляем все отсутствующие правила
                await supabase.from('staff_schedule_rules').insert(inserts);

                // Перезагружаем правила
                const { data: reloadedData } = await supabase
                    .from('staff_schedule_rules')
                    .select('id, date_on, intervals')
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
        const map = new Map<string, TimeRange[]>();
        for (const r of rules) {
            map.set(r.date_on, r.intervals);
        }
        return map;
    }, [rules]);

    async function saveDay(date: string, interval: TimeRange | null) {
        setSaving(true);
        try {
            const existing = rules.find((r) => r.date_on === date);

            // Если interval === null, значит день выходной - сохраняем с пустыми интервалами
            // Если interval есть, значит день рабочий - сохраняем с интервалом
            const intervalsToSave = interval ? [interval] : [];

            if (existing?.id) {
                // Обновляем существующее правило
                await supabase
                    .from('staff_schedule_rules')
                    .update({
                        intervals: intervalsToSave,
                        breaks: [],
                        is_active: true,
                    })
                    .eq('id', existing.id)
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId);
            } else {
                // Создаем новое правило (даже для выходного дня, чтобы пометить его явно)
                await supabase.from('staff_schedule_rules').insert({
                    biz_id: bizId,
                    staff_id: staffId,
                    kind: 'date',
                    date_on: date,
                    branch_id: homeBranchId,
                    tz: TZ,
                    intervals: intervalsToSave,
                    breaks: [],
                    is_active: true,
                    priority: 0,
                });
            }

            // Перезагружаем правила
            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, intervals')
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
                }))
            );
        } catch (error) {
            console.error('Error saving schedule:', error);
            alert('Ошибка при сохранении расписания');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Текущая неделя
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                        {formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}
                    </p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
                    {currentWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const intervals = rulesByDate.get(dateStr);
                        // Если правила нет - null (рабочий день по умолчанию)
                        // Если правило есть с пустыми интервалами - [] (выходной день)
                        // Если правило есть с интервалами - массив интервалов (рабочий день)
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={dow}
                                intervals={intervals !== undefined ? intervals : null}
                                saving={saving}
                                onSave={saveDay}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Следующая неделя
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                        {formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}
                    </p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
                    {nextWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const intervals = rulesByDate.get(dateStr);
                        // Если правила нет - null (рабочий день по умолчанию)
                        // Если правило есть с пустыми интервалами - [] (выходной день)
                        // Если правило есть с интервалами - массив интервалов (рабочий день)
                        return (
                            <DayRow
                                key={dateStr}
                                date={date}
                                dow={dow}
                                intervals={intervals !== undefined ? intervals : null}
                                saving={saving}
                                onSave={saveDay}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p className="font-medium">Как работает расписание</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                            <li>По умолчанию все дни рабочие (09:00-21:00)</li>
                            <li>Отметьте чекбокс "Выходной день", чтобы сделать день нерабочим</li>
                            <li>Можно управлять расписанием только на текущую и следующую неделю</li>
                            <li>Прошедшие даты недоступны для редактирования</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
