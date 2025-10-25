'use client';

import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// helpers
function toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function fromYmdLocal(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m as number) - 1, d);
}

export default function DateRangePicker({
                                            from,
                                            to,
                                            onChange,
                                            className = '',
                                        }: {
    from: string | null; // 'yyyy-MM-dd'
    to: string | null;   // 'yyyy-MM-dd'
    onChange: (next: { from: string | null; to: string | null }) => void;
    className?: string;
}) {
    const sel: DateRange | undefined =
        from || to
            ? { from: from ? fromYmdLocal(from) : undefined, to: to ? fromYmdLocal(to) : undefined }
            : undefined;

    return (
        <div className={`border rounded p-2 bg-white dark:bg-[#0b0b0d] ${className}`}>
            <DayPicker
                mode="range"
                selected={sel}
                onSelect={(r) =>
                    onChange({
                        from: r?.from ? toYmdLocal(r.from) : null,
                        to: r?.to ? toYmdLocal(r.to) : r?.from ? toYmdLocal(r.from) : null,
                    })
                }
                numberOfMonths={2}
                weekStartsOn={1}
                showOutsideDays
                classNames={{
                    root: 'w-full',
                    months: 'w-full flex gap-4',
                    month: 'w-full',
                    caption: 'font-semibold text-sm px-2 py-1',
                    head_cell: 'text-[11px] text-gray-500',
                    table: 'w-full',
                    cell: 'p-0',
                    day: 'text-[12px] px-2 py-1 m-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800',
                    day_selected: 'bg-gray-900 text-white hover:bg-gray-900',
                    day_range_middle: 'bg-gray-200 dark:bg-gray-800',
                    day_today: 'ring-1 ring-gray-500',
                }}
            />
        </div>
    );
}
