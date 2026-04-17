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
            role="group"
            aria-label={t('datePicker.calendarLabel', 'Календарь выбора даты записи')}
            className={[
                'rounded-[20px] p-3 shadow-[var(--shadow-sm)]',
                isDashboard
                    ? 'border border-[var(--accent-primary)]/45 bg-[color:color-mix(in_srgb,var(--surface-card)_88%,var(--surface-canvas))]'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface-card)]',
                className,
            ].join(' ')}
        >
            <div className="flex items-center justify-between px-1 pb-2">
                <p className="type-caption font-medium text-[var(--text-secondary)]">
                    {t('datePicker.chooseDate', 'Выберите удобный день')}
                </p>
                <div className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-primary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                    {format(value, 'dd.MM.yyyy', { locale: dateLocale })}
                </div>
            </div>

            <div className="flex items-center justify-between px-1 pb-2">
                <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    disabled={!canGoPrev}
                    aria-label={t('datePicker.prevMonth', 'Предыдущий месяц')}
                    className="motion-interactive inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--accent-primary)_12%,transparent)] hover:text-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    ‹
                </button>
                <div className="text-sm font-semibold capitalize text-[var(--text-primary)]" aria-live="polite">
                    {monthLabel}
                </div>
                <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    disabled={!canGoNext}
                    aria-label={t('datePicker.nextMonth', 'Следующий месяц')}
                    className="motion-interactive inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--accent-primary)_12%,transparent)] hover:text-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    ›
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
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
                            aria-label={format(day, 'PPPP', { locale: dateLocale })}
                            aria-pressed={selected}
                            className={[
                                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                                disabled
                                    ? 'cursor-not-allowed text-[var(--text-muted)]/45'
                                    : 'cursor-pointer text-[var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--accent-primary)_12%,transparent)] hover:text-[var(--accent-primary)]',
                                selected &&
                                    'bg-[linear-gradient(120deg,var(--accent-primary),var(--accent-secondary))] text-[var(--text-inverse)] hover:text-[var(--text-inverse)]',
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

            <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-[11px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[linear-gradient(120deg,var(--accent-primary),var(--accent-secondary))]" />
                    <span>{t('datePicker.legend.selected', 'Выбранный день')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/45" />
                    <span>{t('datePicker.legend.disabled', 'Недоступно для записи')}</span>
                </div>
            </div>
        </div>
    );
}

