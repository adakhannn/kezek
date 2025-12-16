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
        if (newStart && end && newStart < end) {
            onChange({ start: newStart, end });
        } else if (newStart) {
            onChange({ start: newStart, end: end || '21:00' });
        }
    }

    function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newEnd = e.target.value;
        if (start && newEnd && start < newEnd) {
            onChange({ start, end: newEnd });
        } else if (newEnd) {
            onChange({ start: start || '09:00', end: newEnd });
        }
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type="time"
                className="border rounded px-2 py-1 text-sm"
                value={start}
                onChange={handleStartChange}
                disabled={disabled}
            />
            <span className="text-sm text-gray-500">—</span>
            <input
                type="time"
                className="border rounded px-2 py-1 text-sm"
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
    // Если правила нет в БД или интервалы пустые - день выходной
    // Если правила нет - день рабочий по умолчанию
    const isDayOffFromDb = intervals !== null && intervals !== undefined && intervals.length === 0;
    const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };
    
    const [isDayOff, setIsDayOff] = useState(isDayOffFromDb);
    const [interval, setInterval] = useState<TimeRange>(
        intervals && intervals.length > 0 ? intervals[0] : defaultInterval
    );

    useEffect(() => {
        // Если правила нет (null) - день рабочий по умолчанию
        // Если правило есть, но интервалы пустые - день выходной
        const isOff = intervals !== null && intervals !== undefined && intervals.length === 0;
        setIsDayOff(isOff);
        if (intervals && intervals.length > 0) {
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

    return (
        <div className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium">{DOW[dow]}</div>
                    <div className="text-xs text-gray-500">{dateStr}</div>
                </div>
                <button
                    className="border rounded px-3 py-1 text-sm"
                    disabled={saving}
                    onClick={handleSave}
                >
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>
            <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isDayOff}
                        onChange={handleDayOffChange}
                        disabled={saving}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Выходной день</span>
                </label>
                {!isDayOff && (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Рабочее время</div>
                        <SingleTimeRange 
                            value={interval} 
                            onChange={(v) => v && setInterval(v)} 
                            disabled={saving || isDayOff}
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
            setRules(
                (data ?? []).map((r) => ({
                    id: r.id,
                    date_on: r.date_on,
                    intervals: (r.intervals ?? []) as TimeRange[],
                }))
            );
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, staffId, currentWeekDates, nextWeekDates]);

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
        <section className="border rounded p-4 space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2">Текущая неделя</h2>
                <p className="text-sm text-gray-600 mb-4">
                    {formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

            <div>
                <h2 className="text-lg font-semibold mb-2">Следующая неделя</h2>
                <p className="text-sm text-gray-600 mb-4">
                    {formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

            <div className="text-sm text-gray-500 pt-4 border-t">
                <p>• По умолчанию все дни рабочие (09:00-21:00). Отметьте чекбокс "Выходной день", чтобы сделать день нерабочим.</p>
                <p>• Можно управлять расписанием только на текущую и следующую неделю</p>
            </div>
        </section>
    );
}
