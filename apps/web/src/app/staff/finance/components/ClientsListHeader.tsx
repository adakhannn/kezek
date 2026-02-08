// apps/web/src/app/staff/finance/components/ClientsListHeader.tsx

import { formatInTimeZone } from 'date-fns-tz';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { Button } from '@/components/ui/Button';
import { TZ } from '@/lib/time';


interface ClientsListHeaderProps {
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    isOpen: boolean;
    isClosed: boolean;
    savingItems: boolean;
    saving: boolean;
    staffId?: string;
    onAddClient: () => void;
}

export function ClientsListHeader({
    shiftDate,
    onShiftDateChange,
    isOpen,
    isClosed,
    savingItems,
    saving,
    staffId,
    onAddClient,
}: ClientsListHeaderProps) {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('staff.finance.clients.title', 'Клиенты за смену')}
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
                </div>
            </div>
            {/* Для владельца: показываем кнопку, если смена не закрыта (может быть открыта или еще не создана) */}
            {/* Для сотрудника: показываем кнопку только если смена открыта */}
            {((staffId && !isClosed) || (!staffId && isOpen)) && (
                <div className="flex items-center gap-2">
                    {savingItems && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('staff.finance.clients.saving', 'Сохранение...')}
                        </span>
                    )}
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onAddClient}
                        disabled={saving || savingItems}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('staff.finance.clients.add', 'Добавить клиента')}
                    </Button>
                </div>
            )}
        </div>
    );
}

