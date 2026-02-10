// apps/web/src/app/staff/finance/components/ClientItem.tsx

import type { ShiftItem } from '../types';
import { formatTime } from '../utils';
import { checkPermissions, getPermissionMessage, type PermissionContext } from '../utils/permissions';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

interface ClientItemProps {
    item: ShiftItem;
    idx: number;
    isOpen: boolean;
    isClosed: boolean;
    isReadOnly: boolean;
    staffId?: string;
    isPending?: boolean; // Флаг для отображения индикатора сохранения
    onEdit: () => void;
    onDelete: () => void;
}

export function ClientItem({ item, _idx, isOpen, isClosed, isReadOnly, staffId, isPending = false, onEdit, onDelete }: ClientItemProps) {
    const { t, locale } = useLanguage();
    const hasBooking = !!item.bookingId;
    // Элемент считается новым (не сохранен), если у него нет id
    const isNew = !item.id;
    
    // Проверяем права доступа
    const permissionContext: PermissionContext = {
        staffId,
        isOpen,
        isClosed,
        isReadOnly
    };
    const permissions = checkPermissions(permissionContext);
    const canEdit = permissions.canEdit;
    const canDelete = permissions.canDelete;
    
    // Получаем сообщения о недоступных действиях
    const editMessage = getPermissionMessage('edit', permissionContext);
    const deleteMessage = getPermissionMessage('delete', permissionContext);

    return (
        <div
            className={`group flex items-center justify-between py-3 px-4 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all relative ${
                canEdit
                    ? 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer hover:shadow-md hover:shadow-indigo-100 dark:hover:shadow-indigo-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
            } ${isPending || isNew ? 'opacity-75' : ''}`}
            onClick={() => canEdit && onEdit()}
        >
            {/* Индикатор сохранения для новых элементов или элементов в процессе сохранения */}
            {(isPending || isNew) && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                    <svg className="animate-spin h-3 w-3 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {isNew ? t('staff.finance.clients.saving', 'Сохранение...') : t('staff.finance.clients.pending', 'Обработка...')}
                    </span>
                </div>
            )}
            {/* Desktop view - grid */}
            <div className="hidden sm:flex flex-1 grid grid-cols-[2fr,2fr,1fr,1fr,1fr,auto] gap-3 items-center min-w-0">
                <div className="min-w-0 flex items-center gap-2">
                    {hasBooking && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" title={t('staff.finance.clients.fromBooking', 'Из записи')} />
                    )}
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {item.clientName || t('staff.finance.clients.notSpecified', 'Клиент не указан')}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {item.serviceName || <span className="text-gray-400 italic">—</span>}
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-bold ${(item.serviceAmount ?? 0) > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {(item.serviceAmount ?? 0) === 0 && !item.serviceName
                            ? <span className="text-gray-400">—</span>
                            : `${(item.serviceAmount ?? 0).toLocaleString('ru-RU')} ${t('staff.finance.shift.som', 'сом')}`}
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-semibold ${(item.consumablesAmount ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                        {(item.consumablesAmount ?? 0) === 0
                            ? <span className="text-gray-400">0</span>
                            : `${(item.consumablesAmount ?? 0).toLocaleString('ru-RU')}`} {t('staff.finance.shift.som', 'сом')}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {item.createdAt ? formatTime(item.createdAt, locale) : <span className="text-gray-400">—</span>}
                    </div>
                </div>
            </div>
            
            {/* Mobile view - stacked */}
            <div className="sm:hidden flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {hasBooking && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" title={t('staff.finance.clients.fromBooking', 'Из записи')} />
                        )}
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {item.clientName || t('staff.finance.clients.notSpecified', 'Клиент не указан')}
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                        {item.createdAt ? formatTime(item.createdAt, locale) : <span className="text-gray-400">—</span>}
                    </div>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate">
                    {item.serviceName || <span className="text-gray-400 italic">—</span>}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('staff.finance.clients.amount', 'Сумма')}</div>
                        <div className={`text-sm font-bold ${(item.serviceAmount ?? 0) > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                            {(item.serviceAmount ?? 0) === 0 && !item.serviceName
                                ? <span className="text-gray-400">—</span>
                                : `${(item.serviceAmount ?? 0).toLocaleString('ru-RU')} ${t('staff.finance.shift.som', 'сом')}`}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('staff.finance.clients.consumables', 'Расходники')}</div>
                        <div className={`text-sm font-semibold ${(item.consumablesAmount ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                            {(item.consumablesAmount ?? 0) === 0
                                ? <span className="text-gray-400">0</span>
                                : `${(item.consumablesAmount ?? 0).toLocaleString('ru-RU')}`} {t('staff.finance.shift.som', 'сом')}
                        </div>
                    </div>
                </div>
            </div>
            
            {(canEdit || canDelete) && (
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {canEdit ? (
                        <button
                            type="button"
                            className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-all shadow-sm hover:shadow"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            title={t('staff.finance.clients.edit', 'Редактировать')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    ) : editMessage ? (
                        <button
                            type="button"
                            className="p-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-not-allowed opacity-50"
                            disabled
                            title={editMessage}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    ) : null}
                    {canDelete ? (
                        <button
                            type="button"
                            className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-all shadow-sm hover:shadow"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('staff.finance.clients.confirmDelete', 'Удалить этого клиента?'))) {
                                    onDelete();
                                }
                            }}
                            title={t('staff.finance.clients.delete', 'Удалить')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    ) : deleteMessage ? (
                        <button
                            type="button"
                            className="p-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-not-allowed opacity-50"
                            disabled
                            title={deleteMessage}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}

