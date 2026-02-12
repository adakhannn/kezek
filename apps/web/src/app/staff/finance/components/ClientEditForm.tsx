// apps/web/src/app/staff/finance/components/ClientEditForm.tsx

import { formatInTimeZone } from 'date-fns-tz';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';

import type { ShiftItem, Booking, ServiceName } from '../types';
import { getServiceName } from '../utils';
import { validateShiftItem } from '../utils/validation';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';

interface ClientEditFormProps {
    item: ShiftItem;
    idx: number;
    allItems: ShiftItem[];
    bookings: Booking[];
    serviceOptions: ServiceName[];
    isOpen: boolean;
    isReadOnly: boolean;
    isSaving?: boolean; // Флаг для блокировки кнопки сохранения
    onUpdate: (idx: number, item: ShiftItem) => void;
    onSave?: (idx: number) => void;
    onCollapse: (idx: number) => void;
}

function ClientEditFormInner({
    item,
    idx,
    allItems,
    bookings,
    serviceOptions,
    isOpen,
    isReadOnly,
    isSaving = false,
    onUpdate,
    onSave,
    onCollapse,
}: ClientEditFormProps) {
    const { t, locale } = useLanguage();
    
    // Валидация item с debounce для избежания лишних проверок
    const [validationErrors, setValidationErrors] = useState<{
        clientName?: string;
        serviceName?: string;
        serviceAmount?: string;
        consumablesAmount?: string;
    }>({});
    
    // Отслеживаем, какие поля были "тронуты" (получили фокус и потеряли его)
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    
    // Валидируем item при изменении (с небольшой задержкой для избежания лишних проверок)
    // Но показываем ошибки только для "тронутых" полей
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const validation = validateShiftItem(item);
            // Показываем ошибки только для тронутых полей
            const filteredErrors: typeof validationErrors = {};
            if (touchedFields.has('clientName') && validation.errors.clientName) {
                filteredErrors.clientName = validation.errors.clientName;
            }
            if (touchedFields.has('serviceName') && validation.errors.serviceName) {
                filteredErrors.serviceName = validation.errors.serviceName;
            }
            if (touchedFields.has('serviceAmount') && validation.errors.serviceAmount) {
                filteredErrors.serviceAmount = validation.errors.serviceAmount;
            }
            if (touchedFields.has('consumablesAmount') && validation.errors.consumablesAmount) {
                filteredErrors.consumablesAmount = validation.errors.consumablesAmount;
            }
            setValidationErrors(filteredErrors);
        }, 300); // 300ms debounce
        
        return () => clearTimeout(timeoutId);
    }, [item, touchedFields]);
    
    // Обработчик потери фокуса - помечаем поле как "тронутое" и валидируем его
    const handleBlur = useCallback((fieldName: string) => {
        setTouchedFields((prev) => new Set(prev).add(fieldName));
        // Немедленная валидация поля при потере фокуса
        const validation = validateShiftItem(item);
        setValidationErrors((prev) => ({
            ...prev,
            [fieldName]: validation.errors[fieldName as keyof typeof validation.errors],
        }));
    }, [item]);
    
    // Проверяем, есть ли ошибки валидации (для всех полей, не только тронутых)
    const hasErrors = useMemo(() => {
        const fullValidation = validateShiftItem(item);
        return Object.keys(fullValidation.errors).length > 0;
    }, [item]);

    const handleBookingChange = (bookingId: string | null) => {
        const booking = bookingId ? bookings.find((b) => b.id === bookingId) : null;
        const service = booking?.services
            ? Array.isArray(booking.services)
                ? booking.services[0]
                : booking.services
            : null;
        
        // Если bookingId убран, генерируем автоматическое имя "Клиент N"
        let newClientName = item.clientName;
        if (!bookingId && !booking) {
            const clientLabel = t('staff.finance.clients.client', 'Клиент');
            // Считаем порядковый номер для автоматического имени
            // на основе существующих клиентов без bookingId (кроме текущего)
            const existingClients = allItems
                .filter((it, i) => i !== idx && !it.bookingId && it.clientName?.startsWith(`${clientLabel} `));
            const existingIndices = existingClients
                .map((it) => {
                    const escapedLabel = clientLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`^${escapedLabel} (\\d+)$`);
                    const match = it.clientName?.match(regex);
                    return match ? Number(match[1]) : 0;
                })
                .filter((n) => n > 0);
            const maxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : 0;
            const nextIndex = maxIndex + 1;
            newClientName = `${clientLabel} ${nextIndex}`;
        }
        
        onUpdate(idx, {
            ...item,
            bookingId,
            clientName: booking
                ? booking.client_name || booking.client_phone || item.clientName
                : newClientName,
            serviceName: service ? service.name_ru : item.serviceName,
        });
    };

    const handleServiceChange = (serviceName: string) => {
        onUpdate(idx, { ...item, serviceName });
    };

    const handleServiceAmountChange = (serviceAmount: number) => {
        onUpdate(idx, { ...item, serviceAmount });
    };

    const handleConsumablesAmountChange = (consumablesAmount: number) => {
        onUpdate(idx, { ...item, consumablesAmount });
    };

    return (
        <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-gray-900 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {t('staff.finance.clients.editing', 'Редактирование клиента')}
                    </h3>
                </div>
                <button
                    type="button"
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    onClick={() => onCollapse(idx)}
                    title={t('staff.finance.clients.collapse', 'Свернуть')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Левая колонка */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.client', 'Клиент')}
                            <span className="text-red-500 ml-1">*</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.clientHint', 'обязательно, если не выбран из записей')})
                            </span>
                        </label>
                        <select
                            className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                validationErrors.clientName
                                    ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                            value={item.bookingId ?? ''}
                            onChange={(e) => handleBookingChange(e.target.value || null)}
                            disabled={!isOpen || isReadOnly}
                        >
                            <option value="">{t('staff.finance.clients.selectFromBookings', 'Выберите клиента из записей...')}</option>
                            {bookings.map((b) => {
                                const service = b.services
                                    ? Array.isArray(b.services)
                                        ? b.services[0]
                                        : b.services
                                    : null;
                                const clientLabel = b.client_name || b.client_phone || t('staff.finance.clients.client', 'Клиент');
                                const serviceLabel = service ? getServiceName(service, locale) : '';
                                const time = formatInTimeZone(new Date(b.start_at), TZ, 'HH:mm');
                                return (
                                    <option key={b.id} value={b.id}>
                                        {clientLabel} - {serviceLabel} ({time})
                                    </option>
                                );
                            })}
                        </select>
                        {!item.bookingId && (
                            <div className="mt-2">
                                <input
                                    type="text"
                                    className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                        validationErrors.clientName
                                            ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                                    }`}
                                    value={item.clientName || ''}
                                    onChange={(e) => onUpdate(idx, { ...item, clientName: e.target.value })}
                                    onBlur={() => handleBlur('clientName')}
                                    disabled={!isOpen || isReadOnly}
                                    placeholder={t('staff.finance.clients.clientPlaceholder', 'Введите имя клиента')}
                                    maxLength={200}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.clients.walkInHint', 'Имя формируется автоматически для клиентов «с улицы»')}
                                </p>
                            </div>
                        )}
                        {validationErrors.clientName && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {validationErrors.clientName}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.service', 'Услуга')}
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.serviceHint', 'опционально, до 200 символов')})
                            </span>
                        </label>
                        <select
                            className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                validationErrors.serviceName
                                    ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                            value={item.serviceName}
                            onChange={(e) => handleServiceChange(e.target.value)}
                            onBlur={() => handleBlur('serviceName')}
                            disabled={!isOpen || isReadOnly}
                        >
                            <option value="">{t('staff.finance.clients.selectService', 'Выберите услугу...')}</option>
                            {serviceOptions.map((svc) => {
                                const displayName = getServiceName(svc, locale);
                                const value = svc.name_ru;
                                return (
                                    <option key={value} value={value}>
                                        {displayName}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* Правая колонка */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.servicePrice', 'Цена за услугу')}
                            <span className="text-gray-500 ml-1">(сом)</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.amountHint', '0 - 100,000,000')})
                            </span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100000000}
                                step="50"
                                placeholder="0"
                                className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 pr-12 text-sm text-right font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                    validationErrors.serviceAmount
                                        ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                                }`}
                                value={item.serviceAmount || ''}
                                onChange={(e) => handleServiceAmountChange(Number(e.target.value || 0))}
                                onBlur={() => handleBlur('serviceAmount')}
                                disabled={!isOpen || isReadOnly}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                сом
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.consumablesAmount', 'Расходники')}
                            <span className="text-gray-500 ml-1">(сом)</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.amountHint', '0 - 100,000,000')})
                            </span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100000000}
                                step="10"
                                placeholder="0"
                                className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 pr-12 text-sm text-right font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                    validationErrors.consumablesAmount
                                        ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-amber-500 focus:ring-amber-500/20'
                                }`}
                                value={item.consumablesAmount || ''}
                                onChange={(e) => handleConsumablesAmountChange(Number(e.target.value || 0))}
                                onBlur={() => handleBlur('consumablesAmount')}
                                disabled={!isOpen || isReadOnly}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                сом
                            </span>
                        </div>
                        {validationErrors.consumablesAmount && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {validationErrors.consumablesAmount}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Общее сообщение об ошибках валидации */}
            {hasErrors && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">
                        {t('staff.finance.validation.errors', 'Обнаружены ошибки валидации')}
                    </p>
                    <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5">
                        {validationErrors.clientName && <li>{validationErrors.clientName}</li>}
                        {validationErrors.serviceName && <li>{validationErrors.serviceName}</li>}
                        {validationErrors.serviceAmount && <li>{validationErrors.serviceAmount}</li>}
                        {validationErrors.consumablesAmount && <li>{validationErrors.consumablesAmount}</li>}
                    </ul>
                </div>
            )}
            
            {isOpen && !isReadOnly && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-indigo-200 dark:border-indigo-800">
                    <button
                        type="button"
                        className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm hover:shadow"
                        onClick={() => onCollapse(idx)}
                    >
                        {t('staff.finance.clients.cancel', 'Отмена')}
                    </button>
                    <button
                        type="button"
                        disabled={hasErrors || isSaving}
                        className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 transform ${
                            hasErrors || isSaving
                                ? 'text-gray-400 bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                : 'text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:ring-indigo-500 hover:scale-105'
                        }`}
                        onClick={() => {
                            if (hasErrors || isSaving) {
                                return; // Не сохраняем при наличии ошибок или во время сохранения
                            }
                            if (onSave) {
                                void onSave(idx);
                            } else {
                                onCollapse(idx);
                            }
                        }}
                    >
                        {isSaving 
                            ? t('staff.finance.clients.saving', 'Сохранение...')
                            : t('staff.finance.clients.save', 'Сохранить')
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Оптимизированный компонент формы редактирования клиента
 * Мемоизирован для предотвращения лишних ре-рендеров при изменении других элементов списка
 */
export const ClientEditForm = memo(ClientEditFormInner, (prevProps: ClientEditFormProps, nextProps: ClientEditFormProps) => {
    // Сравниваем только те пропсы, которые влияют на рендер
    // Для ClientEditForm важно сравнивать item более детально, так как форма может быть открыта
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.clientName === nextProps.item.clientName &&
        prevProps.item.serviceName === nextProps.item.serviceName &&
        prevProps.item.serviceAmount === nextProps.item.serviceAmount &&
        prevProps.item.consumablesAmount === nextProps.item.consumablesAmount &&
        prevProps.item.bookingId === nextProps.item.bookingId &&
        prevProps.item.createdAt === nextProps.item.createdAt &&
        prevProps.idx === nextProps.idx &&
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.isReadOnly === nextProps.isReadOnly &&
        prevProps.isSaving === nextProps.isSaving &&
        // allItems, bookings, serviceOptions могут изменяться, но это редко
        // onUpdate, onSave, onCollapse должны быть стабильными функциями из useCallback
        prevProps.allItems.length === nextProps.allItems.length &&
        prevProps.bookings.length === nextProps.bookings.length &&
        prevProps.serviceOptions.length === nextProps.serviceOptions.length
    );
});

