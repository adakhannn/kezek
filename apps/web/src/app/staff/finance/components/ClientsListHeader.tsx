// apps/web/src/app/staff/finance/components/ClientsListHeader.tsx

import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem, Shift } from '../types';
import { exportClientsToCSV } from '../utils/export';
import { checkPermissions, getPermissionMessage, type PermissionContext } from '../utils/permissions';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { Button } from '@/components/ui/Button';
import { TZ } from '@/lib/time';


interface ClientsListHeaderProps {
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    isOpen: boolean;
    isClosed: boolean;
    isReadOnly?: boolean;
    savingItems: boolean;
    saving: boolean;
    staffId?: string;
    onAddClient: () => void;
    items: ShiftItem[];
    shift: Shift | null;
}

export function ClientsListHeader({
    shiftDate,
    onShiftDateChange,
    isOpen,
    isClosed,
    isReadOnly = false,
    savingItems,
    saving,
    staffId,
    onAddClient,
    items,
    shift,
}: ClientsListHeaderProps) {
    const { t } = useLanguage();
    
    // Проверяем права доступа
    const permissionContext: PermissionContext = {
        staffId,
        isOpen,
        isClosed,
        isReadOnly
    };
    const permissions = checkPermissions(permissionContext);
    const canAdd = permissions.canAdd;
    const addMessage = getPermissionMessage('add', permissionContext);

    const handleExport = () => {
        exportClientsToCSV(items, shift, shiftDate);
    };

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
            {/* Показываем кнопки действий */}
            <div className="flex items-center gap-2">
                {/* Кнопка экспорта */}
                {items.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={saving || savingItems}
                        title={t('staff.finance.clients.export', 'Экспорт в CSV')}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('staff.finance.clients.export', 'Экспорт')}
                    </Button>
                )}
                
                {/* Показываем кнопку добавления клиента, если есть права или для показа сообщения */}
                {(canAdd || addMessage) && (
                    <>
                        {savingItems && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('staff.finance.clients.saving', 'Сохранение...')}
                            </span>
                        )}
                        {canAdd ? (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onAddClient}
                                disabled={saving || savingItems}
                                title={t('staff.finance.clients.add', 'Добавить клиента')}
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t('staff.finance.clients.add', 'Добавить клиента')}
                            </Button>
                        ) : addMessage ? (
                            <Button
                                variant="primary"
                                size="sm"
                                disabled
                                title={addMessage}
                                className="opacity-50 cursor-not-allowed"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t('staff.finance.clients.add', 'Добавить клиента')}
                            </Button>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

