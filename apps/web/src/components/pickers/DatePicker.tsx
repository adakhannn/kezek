'use client';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// --- helpers: локальное форматирование/парсинг YYYY-MM-DD без UTC-сдвига
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

export default function DatePicker({
                                       value,
                                       onChange,
                                       className = '',
                                   }: {
    value: string | null;              // 'yyyy-MM-dd'
    onChange: (val: string | null) => void;
    className?: string;
}) {
    const selected = value ? fromYmdLocal(value) : undefined;

    return (
        <div className={`border rounded p-2 bg-white dark:bg-[#0b0b0d] ${className}`}>
            <DayPicker
                mode="single"
                selected={selected}
                onSelect={(d) => onChange(d ? toYmdLocal(d) : null)}
                weekStartsOn={1}
                showOutsideDays
                classNames={{
                    root: 'w-full',
                    months: 'w-full',
                    month: 'w-full',
                    caption: 'font-semibold text-sm px-2 py-1',
                    head_cell: 'text-[11px] text-gray-500',
                    table: 'w-full',
                    cell: 'p-0',
                    day: 'text-[12px] px-2 py-1 m-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800',
                    day_selected: 'bg-gray-900 text-white hover:bg-gray-900',
                    day_today: 'ring-1 ring-gray-500',
                }}
            />
        </div>
    );
}
