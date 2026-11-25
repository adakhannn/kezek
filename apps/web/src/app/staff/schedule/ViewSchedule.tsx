'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useBusinessTimeZone } from '@/components/BusinessTimeZoneContext';
import { Card } from '@/components/ui/Card';
import { addDaysYmd, businessDayOfWeek, businessWeekDates } from '@/lib/scheduling/businessWeek';
import { supabase } from '@/lib/supabaseClient';
import { transliterate } from '@/lib/transliterate';

type TimeRange = { start: string; end: string };

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
    const tz = useBusinessTimeZone();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const { t, locale } = useLanguage();
    const [rules, setRules] = useState<
        Array<{
            id: string;
            date_on: string;
            intervals: TimeRange[];
            branch_id: string | null;
        }>
    >([]);
    
    // Indexed by Date.getDay(): 0 is Sunday.
    const DOW = [
        t('staff.schedule.dayOfWeek.sunday', 'Вс'),
        t('staff.schedule.dayOfWeek.monday', 'Пн'),
        t('staff.schedule.dayOfWeek.tuesday', 'Вт'),
        t('staff.schedule.dayOfWeek.wednesday', 'Ср'),
        t('staff.schedule.dayOfWeek.thursday', 'Чт'),
        t('staff.schedule.dayOfWeek.friday', 'Пт'),
        t('staff.schedule.dayOfWeek.saturday', 'Сб'),
    ];

    // Получаем даты текущей и следующей недели
    const currentWeekDates = useMemo(() => businessWeekDates(0, tz), [tz]);
    const nextWeekDates = useMemo(() => businessWeekDates(1, tz), [tz]);

    // Загружаем правила для текущей и следующей недели
    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            const weekStart = formatInTimeZone(currentWeekDates[0], tz, 'yyyy-MM-dd');
            const weekEnd = addDaysYmd(formatInTimeZone(nextWeekDates[6], tz, 'yyyy-MM-dd'), 1);

            const { data, error } = await supabase
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
            if (error) {
                // A failed read is not "no schedule" (FE-02).
                setLoadError(true);
                setLoading(false);
                return;
            }
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
    }, [bizId, staffId, currentWeekDates, nextWeekDates, tz]);

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

    if (loadError) {
        return (
            <div role="alert" className="text-center py-8">
                <p className="text-red-600 dark:text-red-400">{t('staff.schedule.loadError', 'Не удалось загрузить расписание')}</p>
            </div>
        );
    }

    return (
        <section className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('staff.schedule.currentWeek', 'Текущая неделя')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {formatInTimeZone(currentWeekDates[0], tz, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(currentWeekDates[6], tz, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentWeekDates.map((date) => {
                        const dow = businessDayOfWeek(date, tz); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
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
                                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    {t('staff.schedule.notConfigured', 'Не настроено')}
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
                    {formatInTimeZone(nextWeekDates[0], tz, 'dd.MM.yyyy')} —{' '}
                    {formatInTimeZone(nextWeekDates[6], tz, 'dd.MM.yyyy')}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nextWeekDates.map((date) => {
                        const dow = businessDayOfWeek(date, tz); // 0-6 (0=воскресенье)
                        const dateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
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
                                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    {t('staff.schedule.notConfigured', 'Не настроено')}
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
                <p>• {t('staff.schedule.defaultScheduleHint', 'День без сохранённого графика не настроен: записи на него нет, пока руководитель не задаст часы')}</p>
            </div>
        </section>
    );
}
