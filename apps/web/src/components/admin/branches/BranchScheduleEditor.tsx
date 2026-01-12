'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type BranchSchedule = {
    day_of_week: number; // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
    start: string; // HH:mm
    end: string; // HH:mm
};

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

type Props = {
    bizId: string;
    branchId: string;
    initialSchedule?: Array<{
        day_of_week: number;
        intervals?: Array<{ start: string; end: string }>;
        breaks?: Array<{ start: string; end: string }>;
    }>;
    apiBase?: string; // API base path, e.g., '/api/branches' or '/admin/api/businesses/{bizId}/branches'
};

export function BranchScheduleEditor({ bizId, branchId, initialSchedule = [], apiBase }: Props) {
    const [schedule, setSchedule] = useState<Map<number, BranchSchedule>>(new Map());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Инициализация расписания
    useEffect(() => {
        const map = new Map<number, BranchSchedule>();
        
        // Загружаем начальное расписание (конвертируем из старого формата с intervals)
        initialSchedule.forEach((s) => {
            // Если это старый формат с intervals, берем первый интервал
            const scheduleItem = s as { day_of_week: number; intervals?: Array<{ start: string; end: string }>; breaks?: Array<{ start: string; end: string }> };
            const firstInterval = scheduleItem.intervals?.[0];
            const start = firstInterval?.start || '09:00';
            const end = firstInterval?.end || '21:00';
            map.set(s.day_of_week, {
                day_of_week: s.day_of_week,
                start,
                end,
            });
        });

        // Инициализируем все дни недели (если их нет)
        for (let dow = 0; dow < 7; dow++) {
            if (!map.has(dow)) {
                map.set(dow, {
                    day_of_week: dow,
                    start: dow === 0 ? '' : '09:00', // Воскресенье по умолчанию выходной
                    end: dow === 0 ? '' : '21:00',
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
            // Конвертируем в формат для API (с intervals для совместимости)
            const scheduleArray = Array.from(schedule.values())
                .filter((s) => s.start && s.end) // Только рабочие дни
                .map((s) => ({
                    day_of_week: s.day_of_week,
                    intervals: [{ start: s.start, end: s.end }],
                    breaks: [],
                }));

            // Определяем API путь
            const apiPath = apiBase 
                ? `${apiBase}/${encodeURIComponent(branchId)}/schedule`
                : `/admin/api/businesses/${bizId}/branches/${branchId}/schedule`;

            const res = await fetch(apiPath, {
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
            start: '',
            end: '',
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
                    Установите рабочие часы для каждого дня недели. Это расписание будет использоваться по умолчанию для всех сотрудников филиала. Если у сотрудника есть индивидуальное расписание, оно имеет приоритет.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 7 }, (_, i) => {
                    const daySchedule = schedule.get(i);
                    if (!daySchedule) return null;

                    const isDayOff = !daySchedule.start || !daySchedule.end;

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
                                                if (e.target.checked) {
                                                    updateDay(i, { start: '09:00', end: '21:00' });
                                                } else {
                                                    updateDay(i, { start: '', end: '' });
                                                }
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Рабочий день</span>
                                    </label>
                                </div>

                                {!isDayOff && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Рабочие часы
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={daySchedule.start}
                                                    onChange={(e) => updateDay(i, { start: e.target.value })}
                                                    className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                                />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                                                <input
                                                    type="time"
                                                    value={daySchedule.end}
                                                    onChange={(e) => updateDay(i, { end: e.target.value })}
                                                    className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                                />
                                            </div>
                                        </div>
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
