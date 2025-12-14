'use client';

import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabaseClient';

type TimeRange = { start: string; end: string };
type WH = { id: string; day_of_week: number; intervals: TimeRange[]; breaks: TimeRange[] };
type Rule = {
    id: string;
    kind: 'weekly' | 'date' | 'range';
    day_of_week: number | null;
    date_on: string | null;
    date_from: string | null;
    date_to: string | null;
    branch_id: string;
    tz: string;
    intervals: TimeRange[];
    breaks: TimeRange[];
    is_active: boolean;
    priority: number;
};
type TimeOff = { id: string; date_from: string; date_to: string; reason: string | null };

const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

function intervalsToStr(j: TimeRange[]): string {
    try {
        const arr = Array.isArray(j) ? j : [];
        if (arr.length === 0) return 'Выходной';
        return arr.map((x) => `${x.start}-${x.end}`).join(', ');
    } catch {
        return 'Выходной';
    }
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
    const [tab, setTab] = useState<'weekly' | 'rules' | 'timeoff'>('weekly');

    const branchesMap = useMemo(() => {
        const map = new Map<string, string>();
        branches.forEach((b) => map.set(b.id, b.name));
        return map;
    }, [branches]);

    // WEEKLY
    const [wh, setWh] = useState<WH[]>([]);
    const whByDow: Record<number, WH | undefined> = useMemo(() => {
        const map: Record<number, WH | undefined> = {};
        for (const row of wh) map[row.day_of_week] = row;
        return map;
    }, [wh]);

    // RULES
    const [rules, setRules] = useState<Rule[]>([]);

    // TIME OFF
    const [timeoff, setTimeoff] = useState<TimeOff[]>([]);
    const [loading, setLoading] = useState(true);

    // load all
    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            const [whRes, rulesRes, toRes] = await Promise.all([
                supabase
                    .from('working_hours')
                    .select('id, day_of_week, intervals, breaks')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .order('day_of_week'),
                supabase
                    .from('staff_schedule_rules')
                    .select('id, kind, day_of_week, date_on, date_from, date_to, branch_id, tz, intervals, breaks, is_active, priority')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('staff_time_off')
                    .select('id, date_from, date_to, reason')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .order('date_from', { ascending: false }),
            ]);
            if (ignore) return;
            setWh(whRes.data ?? []);
            setRules(rulesRes.data ?? []);
            setTimeoff(toRes.data ?? []);
            setLoading(false);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, staffId]);

    if (loading) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">Загрузка расписания...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Табы */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        tab === 'weekly'
                            ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                    onClick={() => setTab('weekly')}
                >
                    Еженедельное расписание
                </button>
                <button
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        tab === 'rules'
                            ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                    onClick={() => setTab('rules')}
                >
                    Правила ({rules.length})
                </button>
                <button
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        tab === 'timeoff'
                            ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                    onClick={() => setTab('timeoff')}
                >
                    Выходные ({timeoff.length})
                </button>
            </div>

            {/* Еженедельное расписание */}
            {tab === 'weekly' && (
                <Card variant="elevated" className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Еженедельное расписание</h2>
                    <div className="space-y-4">
                        {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                            const row = whByDow[dow];
                            const intervals = row?.intervals ?? [];
                            const breaks = row?.breaks ?? [];

                            return (
                                <div
                                    key={dow}
                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{DOW[dow]}</div>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Рабочее время: </span>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {intervalsToStr(intervals)}
                                            </span>
                                        </div>
                                        {breaks.length > 0 && (
                                            <div>
                                                <span className="text-gray-600 dark:text-gray-400">Перерывы: </span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {intervalsToStr(breaks)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Правила */}
            {tab === 'rules' && (
                <Card variant="elevated" className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Правила расписания</h2>
                    {rules.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Нет правил расписания</p>
                    ) : (
                        <div className="space-y-4">
                            {rules.map((rule) => {
                                const branchName = branchesMap.get(rule.branch_id) || 'Неизвестный филиал';
                                let ruleDesc = '';
                                if (rule.kind === 'weekly' && rule.day_of_week !== null) {
                                    ruleDesc = `Каждый ${DOW[rule.day_of_week]}`;
                                } else if (rule.kind === 'date' && rule.date_on) {
                                    ruleDesc = `Дата: ${rule.date_on}`;
                                } else if (rule.kind === 'range' && rule.date_from && rule.date_to) {
                                    ruleDesc = `Период: ${rule.date_from} - ${rule.date_to}`;
                                }

                                return (
                                    <div
                                        key={rule.id}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-gray-100">{ruleDesc}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Филиал: {branchName}</div>
                                            </div>
                                            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                                                Приоритет: {rule.priority}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div>
                                                <span className="text-gray-600 dark:text-gray-400">Рабочее время: </span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {intervalsToStr(rule.intervals)}
                                                </span>
                                            </div>
                                            {rule.breaks.length > 0 && (
                                                <div>
                                                    <span className="text-gray-600 dark:text-gray-400">Перерывы: </span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {intervalsToStr(rule.breaks)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}

            {/* Выходные */}
            {tab === 'timeoff' && (
                <Card variant="elevated" className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Выходные дни</h2>
                    {timeoff.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Нет запланированных выходных</p>
                    ) : (
                        <div className="space-y-4">
                            {timeoff.map((to) => (
                                <div
                                    key={to.id}
                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        {to.date_from === to.date_to
                                            ? to.date_from
                                            : `${to.date_from} - ${to.date_to}`}
                                    </div>
                                    {to.reason && (
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Причина: {to.reason}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

