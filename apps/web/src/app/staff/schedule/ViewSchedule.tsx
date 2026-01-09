'use client';

import { startOfWeek, addDays, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';

type TimeRange = { start: string; end: string };

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DOW_KY = ['Жк', 'Дү', 'Шй', 'Шр', 'Бй', 'Жм', 'Иш'];
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    const { t, locale } = useLanguage();
    const [rules, setRules] = useState<
        Array<{
            id: string;
            date_on: string;
            intervals: TimeRange[];
            branch_id: string | null;
        }>
    >([]);
    
    const DOW = locale === 'ky' ? DOW_KY : locale === 'en' ? DOW_EN : DOW_RU;

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
                .select('id, date_on, intervals, branch_id')
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
                    branch_id: r.branch_id,
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
        const map = new Map<string, { intervals: TimeRange[]; branch_id: string | null }>();
        for (const r of rules) {
            map.set(r.date_on, { intervals: r.intervals, branch_id: r.branch_id });
        }
        return map;
    }, [rules]);
    
    function formatBranchName(name: string): string {
        if (locale === 'en') return transliterate(name);
        return name;
    }

    function formatTimeRange(intervals: TimeRange[] | null | undefined): string {
        if (!intervals || intervals.length === 0) {
            return t('staff.schedule.dayOff', 'Выходной');
        }
        if (intervals.length > 0) {
            const first = intervals[0];
            return `${first.start} - ${first.end}`;
        }
        return t('staff.schedule.dayOff', 'Выходной');
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">{t('staff.schedule.loading', 'Загрузка расписания...')}</p>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('staff.schedule.currentWeek', 'Текущая неделя')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {formatInTimeZone(currentWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(currentWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const rule = rulesByDate.get(dateStr);
                        const intervals = rule?.intervals;
                        const branchId = rule?.branch_id;
                        const isDayOff = intervals !== undefined && intervals.length === 0;
                        const isWorking = intervals !== undefined && intervals.length > 0;
                        const isTemporaryTransfer = branchId && branchId !== homeBranchId;
                        const branch = branchId ? branches.find(b => b.id === branchId) : null;
                        const homeBranch = branches.find(b => b.id === homeBranchId);

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
                                                {t('staff.schedule.dayOff', 'Выходной день')}
                                            </div>
                                        )}
                                        {isWorking && intervals && intervals.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {t('staff.schedule.workingHours', 'Рабочее время')}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {formatTimeRange(intervals)}
                                                </div>
                                            </div>
                                        )}
                                        {!isDayOff && !isWorking && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {t('staff.schedule.workingHours', 'Рабочее время')}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    09:00 - 21:00
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    ({t('staff.schedule.default', 'по умолчанию')})
                                                </div>
                                            </div>
                                        )}
                                        {/* Отображение филиала */}
                                        {!isDayOff && (
                                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                                {isTemporaryTransfer && branch ? (
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('staff.schedule.temporary', 'Временный филиал')}:
                                                        </div>
                                                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                                            {formatBranchName(branch.name)}
                                                        </div>
                                                        {homeBranch && (
                                                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                {t('staff.schedule.mainBranch', 'Основной')}: {formatBranchName(homeBranch.name)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : homeBranch ? (
                                                    <div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('staff.schedule.mainBranch', 'Основной филиал')}:
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            {formatBranchName(homeBranch.name)}
                                                        </div>
                                                    </div>
                                                ) : null}
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
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('staff.schedule.nextWeek', 'Следующая неделя')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {formatInTimeZone(nextWeekDates[0], TZ, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(nextWeekDates[6], TZ, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nextWeekDates.map((date) => {
                        const dow = date.getDay(); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, TZ, 'yyyy-MM-dd');
                        const rule = rulesByDate.get(dateStr);
                        const intervals = rule?.intervals;
                        const branchId = rule?.branch_id;
                        const isDayOff = intervals !== undefined && intervals.length === 0;
                        const isWorking = intervals !== undefined && intervals.length > 0;
                        const isTemporaryTransfer = branchId && branchId !== homeBranchId;
                        const branch = branchId ? branches.find(b => b.id === branchId) : null;
                        const homeBranch = branches.find(b => b.id === homeBranchId);

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
                                                {t('staff.schedule.dayOff', 'Выходной день')}
                                            </div>
                                        )}
                                        {isWorking && intervals && intervals.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {t('staff.schedule.workingHours', 'Рабочее время')}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {formatTimeRange(intervals)}
                                                </div>
                                            </div>
                                        )}
                                        {!isDayOff && !isWorking && (
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    {t('staff.schedule.workingHours', 'Рабочее время')}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    09:00 - 21:00
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    ({t('staff.schedule.default', 'по умолчанию')})
                                                </div>
                                            </div>
                                        )}
                                        {/* Отображение филиала */}
                                        {!isDayOff && (
                                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                                {isTemporaryTransfer && branch ? (
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('staff.schedule.temporary', 'Временный филиал')}:
                                                        </div>
                                                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                                            {formatBranchName(branch.name)}
                                                        </div>
                                                        {homeBranch && (
                                                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                {t('staff.schedule.mainBranch', 'Основной')}: {formatBranchName(homeBranch.name)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : homeBranch ? (
                                                    <div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {t('staff.schedule.mainBranch', 'Основной филиал')}:
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            {formatBranchName(homeBranch.name)}
                                                        </div>
                                                    </div>
                                                ) : null}
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
                <p>• {t('staff.schedule.managedByOwner', 'Расписание управляется владельцем бизнеса')}</p>
                <p>• {t('staff.schedule.defaultScheduleHint', 'Если для дня не указано специальное расписание, действует расписание по умолчанию (09:00-21:00)')}</p>
            </div>
        </section>
    );
}
