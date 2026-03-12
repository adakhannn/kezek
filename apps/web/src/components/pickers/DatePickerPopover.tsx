'use client';

import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { enUS, ru as ruLocale } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

// Локализованные названия месяцев
const MONTHS_BY_LOCALE: Record<'ky' | 'ru' | 'en', string[]> = {
    ru: [
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
    ],
    ky: [
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
    ],
    en: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ],
};

// Отображаемые короткие названия дней недели (Пн–Вс)
const WEEKDAYS_DISPLAY: Record<'ky' | 'ru' | 'en', string[]> = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    ky: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

// date-fns локали (ky пока используем как ru)
const DATE_FNS_LOCALES: Record<'ky' | 'ru' | 'en', Locale> = {
    ru: ruLocale,
    en: enUS,
    ky: ruLocale,
};

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
    inline = false,
}: {
    value: string; // 'yyyy-MM-dd'
    onChange: (val: string) => void;
    min?: string; // 'yyyy-MM-dd'
    max?: string; // 'yyyy-MM-dd'
    className?: string;
    /** Если true, календарь показывается всегда под кнопкой (без попапа) */
    inline?: boolean;
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

    const { t, locale } = useLanguage();

    const displayValue = selected
        ? format(selected, 'dd.MM.yyyy')
        : t('datePicker.placeholder', 'Выберите дату');

    const dayPickerProps = {
        mode: 'single' as const,
        selected,
        onSelect: (d: Date | undefined) => {
            if (d) {
                onChange(toYmdLocal(d));
                if (!inline) setIsOpen(false);
            }
        },
        disabled: (date: Date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
        },
        weekStartsOn: 1 as const,
        showOutsideDays: true,
        locale: DATE_FNS_LOCALES[locale],
        formatters: {
            formatMonthCaption: (month: Date) => {
                // Делаем первую букву заглавной для ru/ky, чтобы выглядело аккуратнее
                const raw = format(month, 'LLLL yyyy', { locale: DATE_FNS_LOCALES[locale] });
                if (!raw) return raw;
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            },
        },
        labels: {
            labelMonthDropdown: () => t('datePicker.monthLabel', 'Месяц'),
            labelYearDropdown: () => t('datePicker.yearLabel', 'Год'),
            labelNext: () => t('datePicker.nextMonth', 'Следующий месяц'),
            labelPrevious: () => t('datePicker.prevMonth', 'Предыдущий месяц'),
        },
        classNames: {
            root: 'w-full text-sm text-gray-900 dark:text-gray-50',
            months: 'w-full flex justify-center',
            month: 'w-full space-y-2',
            caption: 'flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400',
            caption_label: 'text-sm font-semibold text-gray-900 dark:text-gray-50',
            nav: 'flex items-center gap-1',
            nav_button:
                'h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-indigo-600/80 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-950',
            nav_button_previous: '',
            nav_button_next: '',
            table: 'w-full border-collapse',
            // Скрываем встроенную строку с днями недели и выводим свою (см. ниже),
            // чтобы избежать дублирования заголовка дней.
            head_row: 'hidden',
            head_cell: 'pb-1 text-center',
            row: '',
            cell: 'p-0 text-center',
            day: 'mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-900 dark:text-gray-50 hover:bg-indigo-500/10 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer transition-colors',
            day_selected:
                'bg-gradient-to-r from-indigo-500 to-pink-500 text-white hover:from-indigo-500 hover:to-pink-500 hover:text-white shadow-sm',
            day_today: 'ring-2 ring-indigo-400 dark:ring-indigo-400',
            day_disabled: 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-500',
            day_outside: 'text-gray-400 dark:text-gray-600',
            day_hidden: 'invisible',
        },
    };

    const calendarEl = <DayPicker {...dayPickerProps} />;

    if (inline) {
        return (
            <div className={className}>
                <div className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm shadow-gray-200/60 dark:border-gray-700/70 dark:bg-[#05060a] dark:shadow-black/40 flex justify-center">
                    <div className="w-full max-w-md">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {t('datePicker.chooseDate', 'Выберите удобный день')}
                            </p>
                            {selected && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/60">
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    {displayValue}
                                </span>
                            )}
                        </div>
                        {calendarEl}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500">
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
                                <span>{t('datePicker.legend.selected', 'Выбранный день')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-indigo-400" />
                                <span>{t('datePicker.legend.today', 'Сегодня')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300/60 dark:bg-gray-600/80" />
                                <span>{t('datePicker.legend.disabled', 'Недоступно для записи')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                data-testid="date-picker"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={
                    selected
                        ? t('datePicker.selected', `Выбранная дата: ${displayValue}`)
                        : t('datePicker.open', 'Выбрать дату')
                }
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40 min-h-[44px] sm:min-h-[40px] sm:py-2 sm:text-sm touch-manipulation"
            >
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
            {isOpen && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-modal="false"
                    aria-label={t('datePicker.dialogLabel', 'Выбор даты')}
                    className="absolute left-0 top-full z-50 mt-2 border rounded-lg p-3 bg-white dark:bg-[#0b0b0d] shadow-lg sm:left-auto sm:right-0 sm:p-2 max-w-[calc(100vw-2rem)] sm:max-w-none"
                >
                    <div className="w-full">
                        <div className="mb-2 grid grid-cols-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 text-center">
                            {WEEKDAYS_DISPLAY[locale].map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                        {calendarEl}
                    </div>
                </div>
            )}
        </div>
    );
}

