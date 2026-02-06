// apps/web/src/app/staff/finance/components/ShiftHeader.tsx

import { formatInTimeZone } from 'date-fns-tz';

import type { Shift } from '../types';
import { formatTime } from '../utils';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { TZ } from '@/lib/time';


interface ShiftHeaderProps {
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    shift: Shift | null;
    isOpen: boolean;
    staffId?: string;
}

export function ShiftHeader({ shiftDate, onShiftDateChange, shift, isOpen, staffId }: ShiftHeaderProps) {
    const { t, locale } = useLanguage();

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 flex-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('staff.finance.shift.current', 'Текущая смена')}
                        </span>
                        {staffId && (
                            <DatePickerPopover
                                value={formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd')}
                                onChange={(dateStr) => {
                                    const [year, month, day] = dateStr.split('-').map(Number);
                                    onShiftDateChange(new Date(year, month - 1, day));
                                }}
                                className="inline-block"
                            />
                        )}
                    </div>
                    <div className="text-base text-gray-600 dark:text-gray-400">
                        {formatInTimeZone(shiftDate, TZ, 'dd.MM.yyyy')} ({TZ})
                    </div>
                    {shift && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('staff.finance.shift.opened', 'Открыта')}: {formatTime(shift.opened_at, locale)}
                        </div>
                    )}
                </div>
                {shift && (
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isOpen 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                        {isOpen ? t('staff.finance.shift.status.open', 'Открыта') : t('staff.finance.shift.status.closed', 'Закрыта')}
                    </div>
                )}
            </div>
        </div>
    );
}

