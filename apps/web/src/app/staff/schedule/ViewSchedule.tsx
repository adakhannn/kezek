'use client';

import { startOfWeek, addDays, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

type TimeRange = { start: string; end: string };

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Получаем даты текущей и следующей недели
function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Понедельник
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(targetWeekStart, i));
}

export default function ViewSchedule({
    bizId,
    staffId,
    branches,
    homeBranchId,
}: {
    bizId: string;
    staffId: string;
    branches: { id: string; name: string }[];
    homeBranchId: string;
}) {
    const [loading, setLoading] = useState(true);
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
            setLoading(true);
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
            setLoading(false);
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

    function formatTimeRange(intervals: TimeRange[] | null | undefined): string {
        if (!intervals || intervals.length === 0) {
            return 'Выходной';
        }
        if (intervals.length > 0) {
            const first = intervals[0];
            return `${first.start} - ${first.end}`;
        }
        return 'Выходной';
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">Загрузка расписания...</p>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Текущая неделя</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const intervals = rulesByDate.get(dateStr);
                        const isDayOff = intervals !== undefined && intervals.length === 0;
                        const isWorking = intervals !== undefined && intervals.length > 0;

                        return (
                            <Card
                                key={dateStr}
                                variant="elevated"
                                className="p-4"
                            >
                                <div className="space-y-2">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{DOW[dow]}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{dateStr}</div>
                                    </div>
                                    <div className="space-y-1">
                                        {isDayOff && (
                                            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                                                Выходной день
                                            </div>
                                        )}
                                        {isWorking && intervals && intervals.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    Рабочее время
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {formatTimeRange(intervals)}
                                                </div>
                                            </div>
                                        )}
                                        {!isDayOff && !isWorking && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    Рабочее время
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    09:00 - 21:00
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    (по умолчанию)
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Следующая неделя</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nextWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const intervals = rulesByDate.get(dateStr);
                        const isDayOff = intervals !== undefined && intervals.length === 0;
                        const isWorking = intervals !== undefined && intervals.length > 0;

                        return (
                            <Card
                                key={dateStr}
                                variant="elevated"
                                className="p-4"
                            >
                                <div className="space-y-2">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{DOW[dow]}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{dateStr}</div>
                                    </div>
                                    <div className="space-y-1">
                                        {isDayOff && (
                                            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                                                Выходной день
                                            </div>
                                        )}
                                        {isWorking && intervals && intervals.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    Рабочее время
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {formatTimeRange(intervals)}
                                                </div>
                                            </div>
                                        )}
                                        {!isDayOff && !isWorking && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    Рабочее время
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    09:00 - 21:00
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    (по умолчанию)
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p>• Расписание управляется владельцем бизнеса</p>
                <p>• Если для дня не указано специальное расписание, действует расписание по умолчанию (09:00-21:00)</p>
            </div>
        </section>
    );
}
