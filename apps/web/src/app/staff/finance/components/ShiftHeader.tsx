// apps/web/src/app/staff/finance/components/ShiftHeader.tsx

import { formatInTimeZone } from 'date-fns-tz';

import type { Shift } from '../types';
import { formatTime } from '../utils';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';


interface ShiftHeaderProps {
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    shift: Shift | null;
    status: 'open' | 'closed' | 'none';
    staffId?: string;
}

export function ShiftHeader({ shiftDate, onShiftDateChange, shift, status, staffId }: ShiftHeaderProps) {
    const { t, locale } = useLanguage();

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4 flex-1 flex-col md:flex-row">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('staff.finance.shift.current', 'Текущая смена')}
                        </span>
                    </div>
                    <div className="text-base text-gray-600 dark:text-gray-400">
                        {formatInTimeZone(shiftDate, TZ, 'dd.MM.yyyy')} ({TZ})
                    </div>
                    {status === 'open' && shift && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('staff.finance.shift.opened', 'Открыта')}: {formatTime(shift.opened_at, locale)}
                        </div>
                    )}
                    {status === 'none' && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {t('staff.finance.shift.notCreated', 'Смена не открыта')}
                        </div>
                    )}
                </div>
                <div
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
                        status === 'open'
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700'
                            : status === 'closed'
                                ? 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                    }`}
                >
                    {status === 'open' && (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400" />
                            {t('staff.finance.shift.status.open', 'Открыта')}
                        </span>
                    )}
                    {status === 'closed' && (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
                            {t('staff.finance.shift.status.closed', 'Закрыта')}
                        </span>
                    )}
                    {status === 'none' && (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                            {t('staff.finance.shift.status.notCreated', 'Не открыта')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

