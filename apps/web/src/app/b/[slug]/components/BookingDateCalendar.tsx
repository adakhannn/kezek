import { addMonths, eachDayOfInterval, endOfMonth, format, isAfter, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ru, enGB } from 'date-fns/locale';
import type { JSX } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type BookingDateCalendarProps = {
    value: Date;
    onChange: (date: Date) => void;
    min?: Date;
    max?: Date;
    /** Вариант оформления: public (страница записи) или dashboard (кабинет/финансы) */
    variant?: 'public' | 'dashboard';
    className?: string;
};

const WEEKDAYS_LABELS: Record<'ru' | 'ky' | 'en', string[]> = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    ky: ['Дш', 'Шш', 'Шр', 'Бш', 'Жм', 'Иш', 'Жк'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const DATE_LOCALES = {
    ru,
    en: enGB,
    ky: ru,
} as const;

export function BookingDateCalendar({ value, onChange, min, max, variant = 'public', className = '' }: BookingDateCalendarProps): JSX.Element {
    const { locale, t } = useLanguage();
    const dateLocale = DATE_LOCALES[locale] ?? ru;
    const weekdayLabels = WEEKDAYS_LABELS[locale] ?? WEEKDAYS_LABELS.ru;

    const monthStart = startOfMonth(value);
    const monthEnd = endOfMonth(value);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfMonth(monthEnd);

    const days = eachDayOfInterval({ start: calendarStart, end: endOfMonth(addMonths(monthStart, 0)) });

    const canGoPrev =
        !min || !isBefore(startOfMonth(addMonths(monthStart, -1)), startOfMonth(min));
    const canGoNext =
        !max || !isAfter(endOfMonth(addMonths(monthStart, 1)), endOfMonth(max));

    const handleMonthChange = (direction: -1 | 1) => {
        const nextMonth = addMonths(monthStart, direction);
        if (direction === -1 && !canGoPrev) return;
        if (direction === 1 && !canGoNext) return;
        const safeDate = new Date(nextMonth);
        onChange(safeDate);
    };

    const isDisabled = (day: Date) => {
        if (min && isBefore(day, min)) return true;
        if (max && isAfter(day, max)) return true;
        return false;
    };

    const handleSelect = (day: Date) => {
        if (isDisabled(day)) return;
        onChange(day);
    };

    const monthLabel = format(monthStart, 'LLLL yyyy', { locale: dateLocale });

    const isDashboard = variant === 'dashboard';

    return (
        <div
            data-testid="date-picker"
            className={[
                'rounded-2xl p-3 shadow-sm',
                isDashboard
                    ? 'border border-indigo-500/40 bg-slate-950/70 shadow-indigo-500/20'
                    : 'border border-gray-200/80 bg-white shadow-gray-200/60 dark:border-gray-700/70 dark:bg-[#05060a] dark:shadow-black/40',
                className,
            ].join(' ')}
        >
            <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('datePicker.chooseDate', 'Выберите удобный день')}
                </p>
                <div className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {format(value, 'dd.MM.yyyy', { locale: dateLocale })}
                </div>
            </div>

            <div className="flex items-center justify-between px-1 pb-2">
                <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    disabled={!canGoPrev}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-indigo-600/10 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-100"
                >
                    ‹
                </button>
                <div className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-50">
                    {monthLabel}
                </div>
                <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    disabled={!canGoNext}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-indigo-600/10 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-100"
                >
                    ›
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {weekdayLabels.map((label) => (
                    <span key={label}>{label}</span>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-sm">
                {days.map((day) => {
                    const disabled = isDisabled(day) || !isSameMonth(day, monthStart);
                    const selected = isSameDay(day, value);

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            data-date={format(day, 'yyyy-MM-dd')}
                            onClick={() => handleSelect(day)}
                            disabled={disabled}
                            className={[
                                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                                disabled
                                    ? 'cursor-not-allowed text-gray-500/40 dark:text-gray-500/50'
                                    : 'cursor-pointer text-gray-900 hover:bg-indigo-500/10 hover:text-indigo-900 dark:text-gray-50 dark:hover:bg-indigo-500/25 dark:hover:text-indigo-50',
                                selected &&
                                    'bg-gradient-to-r from-indigo-500 to-pink-500 text-white hover:from-indigo-500 hover:to-pink-500',
                                !isSameMonth(day, monthStart) && 'opacity-40',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-[11px] text-gray-500 dark:text-gray-500">
                <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
                    <span>{t('datePicker.legend.selected', 'Выбранный день')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300/60 dark:bg-gray-600/80" />
                    <span>{t('datePicker.legend.disabled', 'Недоступно для записи')}</span>
                </div>
            </div>
        </div>
    );
}

