'use client';

import type { TimeRange } from './scheduleTypes';

export function SingleTimeRange({
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
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">вЂ”</span>
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
