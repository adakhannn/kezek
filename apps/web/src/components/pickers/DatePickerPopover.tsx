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

    // Закрытие при клике вне попапа и при нажатии Escape
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

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            };
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
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={selected ? `Выбранная дата: ${displayValue}` : 'Выбрать дату'}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40 min-h-[44px] sm:min-h-[40px] sm:py-2 sm:text-sm touch-manipulation"
            >
                {/* Иконка календаря */}
                <svg
                    className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
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
                    aria-hidden="true"
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
                    role="dialog"
                    aria-modal="false"
                    aria-label="Выбор даты"
                    className="absolute left-0 top-full z-50 mt-2 border rounded-lg p-3 bg-white dark:bg-[#0b0b0d] shadow-lg sm:left-auto sm:right-0 sm:p-2 max-w-[calc(100vw-2rem)] sm:max-w-none"
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
                            caption: 'font-semibold text-sm px-2 py-1',
                            caption_label: '',
                            caption_dropdowns: '',
                            dropdown: '',
                            dropdown_month: '',
                            dropdown_year: '',
                            nav: '',
                            nav_button: 'min-h-[40px] sm:min-h-[32px] min-w-[40px] sm:min-w-[32px] touch-manipulation',
                            nav_button_previous: 'min-h-[40px] sm:min-h-[32px] min-w-[40px] sm:min-w-[32px] touch-manipulation',
                            nav_button_next: 'min-h-[40px] sm:min-h-[32px] min-w-[40px] sm:min-w-[32px] touch-manipulation',
                            table: 'w-full',
                            head_row: '',
                            head_cell: 'text-[11px] text-gray-500 dark:text-gray-400',
                            row: '',
                            cell: 'p-0',
                            day: 'text-sm sm:text-[12px] px-2 py-2 sm:py-1 m-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[40px] sm:min-h-[32px] min-w-[40px] sm:min-w-[32px] flex items-center justify-center touch-manipulation',
                            day_selected: 'bg-gray-900 text-white hover:bg-gray-900 dark:bg-gray-100 dark:text-gray-900',
                            day_today: 'ring-1 ring-gray-500 dark:ring-gray-400',
                            day_disabled: 'opacity-40 cursor-not-allowed hover:bg-transparent',
                            day_outside: 'text-gray-400 dark:text-gray-600',
                            day_hidden: 'invisible',
                        }}
                    />
                </div>
            )}
        </div>
    );
}

