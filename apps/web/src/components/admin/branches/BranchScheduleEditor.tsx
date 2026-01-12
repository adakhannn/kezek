'use client';

import { useEffect, useState } from 'react';

import TimeRangeList, { type TimeRange } from '@/components/pickers/TimeRangeList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type BranchSchedule = {
    day_of_week: number; // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
    intervals: TimeRange[];
    breaks: TimeRange[];
};

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

type Props = {
    bizId: string;
    branchId: string;
    initialSchedule?: BranchSchedule[];
};

export function BranchScheduleEditor({ bizId, branchId, initialSchedule = [] }: Props) {
    const [schedule, setSchedule] = useState<Map<number, BranchSchedule>>(new Map());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Инициализация расписания
    useEffect(() => {
        const map = new Map<number, BranchSchedule>();
        
        // Загружаем начальное расписание
        initialSchedule.forEach((s) => {
            map.set(s.day_of_week, {
                day_of_week: s.day_of_week,
                intervals: s.intervals || [],
                breaks: s.breaks || [],
            });
        });

        // Инициализируем все дни недели (если их нет)
        for (let dow = 0; dow < 7; dow++) {
            if (!map.has(dow)) {
                map.set(dow, {
                    day_of_week: dow,
                    intervals: dow === 0 ? [] : [{ start: '09:00', end: '21:00' }], // Воскресенье по умолчанию выходной
                    breaks: [],
                });
            }
        }

        setSchedule(map);
        setLoading(false);
    }, [initialSchedule]);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const scheduleArray = Array.from(schedule.values());

            const res = await fetch(`/admin/api/businesses/${bizId}/branches/${branchId}/schedule`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ schedule: scheduleArray }),
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(text || 'Ошибка сервера');
            }

            if (!res.ok || !data.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    function updateDay(dow: number, updates: Partial<BranchSchedule>) {
        const newSchedule = new Map(schedule);
        const current = newSchedule.get(dow) || {
            day_of_week: dow,
            intervals: [],
            breaks: [],
        };
        newSchedule.set(dow, { ...current, ...updates });
        setSchedule(newSchedule);
    }

    if (loading) {
        return <div className="text-center py-4 text-gray-600 dark:text-gray-400">Загрузка расписания...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Расписание работы филиала
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Установите рабочие часы для каждого дня недели. Это расписание будет использоваться по умолчанию для всех сотрудников филиала.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 7 }, (_, i) => {
                    const daySchedule = schedule.get(i);
                    if (!daySchedule) return null;

                    const isDayOff = daySchedule.intervals.length === 0;

                    return (
                        <Card key={i} className="p-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                            {DAY_NAMES[i]}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{DAY_SHORT[i]}</p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!isDayOff}
                                            onChange={(e) => {
                                                updateDay(i, {
                                                    intervals: e.target.checked ? [{ start: '09:00', end: '21:00' }] : [],
                                                });
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Рабочий день</span>
                                    </label>
                                </div>

                                {!isDayOff && (
                                    <div className="space-y-3">
                                        <TimeRangeList
                                            label="Рабочие часы"
                                            items={daySchedule.intervals}
                                            onChange={(intervals) => updateDay(i, { intervals })}
                                        />
                                        <TimeRangeList
                                            label="Перерывы"
                                            items={daySchedule.breaks}
                                            onChange={(breaks) => updateDay(i, { breaks })}
                                        />
                                    </div>
                                )}

                                {isDayOff && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                                        Выходной день
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
            )}

            {success && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">Расписание успешно сохранено</p>
                </div>
            )}

            <div className="flex items-center gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving} isLoading={saving} className="min-w-[160px]">
                    Сохранить расписание
                </Button>
            </div>
        </div>
    );
}

