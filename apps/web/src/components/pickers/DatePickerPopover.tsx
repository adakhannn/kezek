'use client';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';

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

export default function DatePickerPopover({
    value,
    onChange,
    min,
    max,
    className = '',
}: {
    value: string; // 'yyyy-MM-dd'
    onChange: (val: string) => void;
    min?: string; // 'yyyy-MM-dd'
    max?: string; // 'yyyy-MM-dd'
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selected = value ? fromYmdLocal(value) : undefined;
    const minDate = min ? fromYmdLocal(min) : undefined;
    const maxDate = max ? fromYmdLocal(max) : undefined;

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

    const displayValue = selected
        ? format(selected, 'dd.MM.yyyy')
        : 'Выберите дату';

    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40"
            >
                {/* Иконка календаря */}
                <svg
                    className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                <span className="flex-1 text-left">{displayValue}</span>
                {/* Стрелка вниз */}
                <svg
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {/* Попап с календарем */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 top-full z-50 mt-2 w-max min-w-[280px] max-w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:left-auto sm:right-0"
                >
                    <DayPicker
                        mode="single"
                        selected={selected}
                        onSelect={(d) => {
                            if (d) {
                                onChange(toYmdLocal(d));
                                setIsOpen(false);
                            }
                        }}
                        disabled={(date) => {
                            if (minDate && date < minDate) return true;
                            if (maxDate && date > maxDate) return true;
                            return false;
                        }}
                        weekStartsOn={1}
                        showOutsideDays
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
                            caption: 'flex items-center justify-between px-1 py-3 mb-3 border-b border-gray-200 dark:border-gray-700',
                            caption_label: 'text-base font-semibold text-gray-900 dark:text-gray-100',
                            caption_dropdowns: 'flex items-center gap-2',
                            dropdown: 'rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                            dropdown_month: '',
                            dropdown_year: '',
                            nav: 'flex gap-1',
                            nav_button: 'h-8 w-8 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-900/40 dark:hover:border-indigo-600 dark:hover:text-indigo-400',
                            nav_button_previous: '',
                            nav_button_next: '',
                            table: 'w-full border-collapse mt-2',
                            head_row: 'flex w-full mb-1',
                            head_cell: 'w-[calc(100%/7)] text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2 uppercase tracking-wide',
                            row: 'flex w-full mt-1',
                            cell: 'w-[calc(100%/7)] text-center p-0',
                            day: 'h-10 w-10 mx-auto rounded-lg text-sm font-medium text-gray-900 transition-all hover:bg-indigo-100 hover:text-indigo-700 dark:text-gray-100 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300 flex items-center justify-center',
                            day_selected: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-md',
                            day_today: 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-gray-900',
                            day_disabled: 'text-gray-300 opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-300 dark:text-gray-600 dark:hover:bg-transparent',
                            day_outside: 'text-gray-400 opacity-60 dark:text-gray-600',
                            day_hidden: 'invisible',
                        }}
                    />
                    {/* Кнопки внизу календаря */}
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                onChange(toYmdLocal(today));
                                setIsOpen(false);
                            }}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        >
                            Сегодня
                        </button>
                        {selected && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            >
                                Удалить
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

