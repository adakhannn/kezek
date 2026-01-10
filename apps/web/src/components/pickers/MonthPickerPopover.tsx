'use client';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useEffect, useRef, useState } from 'react';

// Русские названия для календаря
const MONTHS = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
];
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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

export default function MonthPickerPopover({
    value,
    onChange,
    className = '',
}: {
    value: string; // 'yyyy-MM-dd' (first day of month)
    onChange: (val: string) => void; // 'yyyy-MM-dd' (first day of month)
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selected = value ? fromYmdLocal(value) : undefined;

    // Закрытие при клике вне попапа
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Форматируем для отображения: месяц и год (например, "Январь 2026")
    const displayValue = selected
        ? `${MONTHS[selected.getMonth()]} ${selected.getFullYear()}`
        : 'Выберите месяц';

    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <span>{displayValue}</span>
                <svg
                    className="w-4 h-4 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                <svg
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Попап с календарем */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 top-full z-50 mt-2 border rounded p-2 bg-white dark:bg-[#0b0b0d] shadow-lg sm:left-auto sm:right-0"
                >
                    <DayPicker
                        mode="single"
                        selected={selected}
                        onSelect={(d) => {
                            if (d) {
                                // Всегда выбираем первый день месяца при клике на любой день
                                const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
                                onChange(toYmdLocal(firstDayOfMonth));
                                setIsOpen(false);
                            }
                        }}
                        // Показываем календарь для выбранного месяца
                        month={selected || new Date()}
                        weekStartsOn={1}
                        showOutsideDays
                        // Включаем dropdown для выбора месяца и года
                        captionLayout="dropdown"
                        fromYear={new Date().getFullYear() - 10}
                        toYear={new Date().getFullYear() + 1}
                        formatters={{
                            formatMonthCaption: (month) => {
                                return MONTHS[month.getMonth()] + ' ' + month.getFullYear();
                            },
                            formatWeekdayName: (day) => {
                                return WEEKDAYS_SHORT[day.getDay()];
                            },
                        }}
                        labels={{
                            labelMonthDropdown: () => 'Месяц',
                            labelYearDropdown: () => 'Год',
                            labelNext: () => 'Следующий месяц',
                            labelPrevious: () => 'Предыдущий месяц',
                        }}
                        classNames={{
                            root: 'w-full',
                            months: 'w-full',
                            month: 'w-full',
                            caption: 'font-semibold text-sm px-2 py-1',
                            caption_dropdowns: 'flex items-center justify-center gap-2',
                            dropdown: 'px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                            dropdown_month: 'mr-2',
                            dropdown_year: 'ml-2',
                            head_cell: 'text-[11px] text-gray-500 dark:text-gray-400',
                            table: 'w-full',
                            cell: 'p-0',
                            day: 'text-[12px] px-2 py-1 m-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
                            day_selected: 'bg-indigo-600 text-white hover:bg-indigo-700',
                            day_today: 'ring-1 ring-indigo-500',
                        }}
                    />
                </div>
            )}
        </div>
    );
}

