'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
    // Получаем начальное время из первого рабочего дня
    const getInitialTime = () => {
        for (const s of initialSchedule) {
            const firstInterval = s.intervals?.[0];
            if (firstInterval?.start && firstInterval?.end) {
                return { start: firstInterval.start, end: firstInterval.end };
            }
        }
        return { start: '09:00', end: '21:00' };
    };

    const initialTime = getInitialTime();
    const [start, setStart] = useState(initialTime.start);
    const [end, setEnd] = useState(initialTime.end);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        if (!start || !end) {
            setError('Укажите время начала и окончания работы');
            setSaving(false);
            return;
        }

        if (start >= end) {
            setError('Время начала должно быть раньше времени окончания');
            setSaving(false);
            return;
        }

        try {
            // Создаем расписание для всех дней недели (кроме воскресенья - выходной по умолчанию)
            const scheduleArray = [];
            for (let dow = 1; dow <= 6; dow++) {
                // 1 = понедельник, ..., 6 = суббота
                scheduleArray.push({
                    day_of_week: dow,
                    intervals: [{ start, end }],
                    breaks: [],
                });
            }

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

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Расписание работы филиала
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Установите рабочие часы, которые будут использоваться по умолчанию для всех сотрудников филиала во все рабочие дни (понедельник - суббота). Воскресенье - выходной день. Если у сотрудника есть индивидуальное расписание, оно имеет приоритет.
                </p>
            </div>

            <Card className="p-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Рабочие часы
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    С
                                </label>
                                <input
                                    type="time"
                                    value={start}
                                    onChange={(e) => setStart(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    До
                                </label>
                                <input
                                    type="time"
                                    value={end}
                                    onChange={(e) => setEnd(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                            Это расписание будет применяться к понедельнику - субботе. Воскресенье - выходной день.
                        </p>
                    </div>
                </div>
            </Card>

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
