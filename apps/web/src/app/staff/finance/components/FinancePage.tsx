/**
 * Оптимизированный компонент страницы финансов
 * Использует React Query для кэширования и оптимистичных обновлений
 */

'use client';

import { useMemo, useState, useCallback, memo, useEffect, useRef } from 'react';

import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceMutations } from '../hooks/useFinanceMutations';
import { useServiceOptions } from '../hooks/useServiceOptions';
import { useShiftCalculations } from '../hooks/useShiftCalculations';
import { useShiftStats } from '../hooks/useShiftStats';
import type { TabKey, PeriodKey, ShiftItem } from '../types';
import { validateShiftItem } from '../utils/validation';

import { ClientsList } from './ClientsList';
import { ClientsListHeader } from './ClientsListHeader';
import { ShiftControls } from './ShiftControls';
import { ShiftHeader } from './ShiftHeader';
import { ShiftSummary } from './ShiftSummary';
import { StatsView } from './StatsView';
import { Tabs } from './Tabs';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { LoadingOverlay } from '@/components/ui/ProgressBar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { todayTz } from '@/lib/time';

interface FinancePageProps {
    staffId?: string;
    showHeader?: boolean;
}

/**
 * Оптимизированный компонент страницы финансов
 */
export const FinancePage = memo(function FinancePage({ staffId, showHeader = true }: FinancePageProps) {
    const { t } = useLanguage();
    const toast = useToast();

    // Состояние для вкладок и дат
    const [activeTab, setActiveTab] = useState<TabKey>(staffId ? 'clients' : 'shift');
    const activeTabRef = useRef<TabKey>(staffId ? 'clients' : 'shift');
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [shiftDate, setShiftDate] = useState<Date>(todayTz());
    const [selectedDate, setSelectedDate] = useState<Date>(todayTz());
    const [selectedMonth, setSelectedMonth] = useState<Date>(todayTz());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showShiftDetails, setShowShiftDetails] = useState(false);
    
    // Обновляем ref при изменении activeTab
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);
    
    // Обертка для setActiveTab, которая также обновляет ref
    const handleTabChange = useCallback((tab: TabKey) => {
        activeTabRef.current = tab;
        setActiveTab(tab);
    }, []);

    // Локальное состояние для items (для оптимистичных обновлений)
    const [localItems, setLocalItems] = useState<ShiftItem[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    // Отслеживаем, какие элементы были только что сохранены (новые элементы без id)
    const savedItemsWithoutIdRef = useRef<Set<number>>(new Set());
    // Ref для отслеживания предыдущих localItems, чтобы избежать бесконечного цикла
    const previousLocalItemsRef = useRef<ShiftItem[]>([]);
    // Флаг для предотвращения синхронизации сразу после добавления нового элемента
    const skipNextSyncRef = useRef(false);

    // Загрузка данных через React Query
    const financeData = useFinanceData({
        staffId,
        date: shiftDate,
        enabled: true,
    });

    // Мутации
    const mutations = useFinanceMutations({ staffId, date: shiftDate });

    // Синхронизируем локальные items с данными из сервера
    useEffect(() => {
        // Пропускаем синхронизацию, если только что добавили новый элемент
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }
        
        if (financeData.data?.items) {
            const serverItems = financeData.data.items;
            // Используем функциональное обновление для получения актуального состояния
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                const localItemsById = new Map(currentLocalItems.filter((item) => item.id).map((item) => [item.id!, item]));
                
                // Объединяем данные: сохраняем только те локальные элементы без id, которых нет на сервере
                const mergedItems: ShiftItem[] = [];
                
                // Сначала добавляем элементы с сервера
                for (const serverItem of serverItems) {
                    if (serverItem.id) {
                        const localItem = localItemsById.get(serverItem.id);
                        if (localItem) {
                            // Объединяем: приоритет локальным данным, если они не пустые
                            mergedItems.push({
                                id: serverItem.id,
                                clientName: (localItem.clientName && localItem.clientName.trim()) || serverItem.clientName || '',
                                serviceName: (localItem.serviceName && localItem.serviceName.trim()) || serverItem.serviceName || '',
                                serviceAmount: localItem.serviceAmount ?? serverItem.serviceAmount ?? 0,
                                consumablesAmount: localItem.consumablesAmount ?? serverItem.consumablesAmount ?? 0,
                                bookingId: localItem.bookingId ?? serverItem.bookingId ?? null,
                                createdAt: localItem.createdAt || serverItem.createdAt || null,
                            });
                        } else {
                            // Новый элемент с сервера (не был в локальных)
                            mergedItems.push(serverItem);
                        }
                    }
                }
                
                // Затем добавляем локальные элементы без id, которые еще не сохранены на сервере
                // Проверяем по содержимому (createdAt, clientName, serviceAmount и т.д.)
                for (const localItemWithoutId of localItemsWithoutId) {
                    // Проверяем, нет ли на сервере элемента с таким же содержимым
                    const isOnServer = serverItems.some((serverItem) => {
                        if (!serverItem.id) return false;
                        // Сравниваем по основным полям
                        return (
                            serverItem.clientName === localItemWithoutId.clientName &&
                            serverItem.serviceName === localItemWithoutId.serviceName &&
                            serverItem.serviceAmount === localItemWithoutId.serviceAmount &&
                            serverItem.consumablesAmount === localItemWithoutId.consumablesAmount &&
                            serverItem.bookingId === localItemWithoutId.bookingId &&
                            serverItem.createdAt === localItemWithoutId.createdAt
                        );
                    });
                    
                    // Добавляем только если элемента нет на сервере
                    if (!isOnServer) {
                        mergedItems.push(localItemWithoutId);
                    }
                }
                
                return mergedItems;
            });
            
            // Закрываем формы только для элементов, которые были только что сохранены
            // (новые элементы без id, которые теперь имеют id)
            if (savedItemsWithoutIdRef.current.size > 0) {
                setExpandedItems((prev) => {
                    const next = new Set(prev);
                    // Закрываем все формы, которые были открыты для сохраненных элементов
                    savedItemsWithoutIdRef.current.forEach((idx) => {
                        next.delete(idx);
                    });
                    savedItemsWithoutIdRef.current.clear();
                    return next;
                });
            }
        } else if (financeData.data && !financeData.isLoading) {
            // Если данных нет, но загрузка завершена, сохраняем только локальные элементы без id
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                // Не закрываем формы, если есть локальные элементы
                if (localItemsWithoutId.length === 0) {
                    setExpandedItems(new Set());
                    savedItemsWithoutIdRef.current.clear();
                }
                return localItemsWithoutId;
            });
        }
    }, [financeData.data?.items, financeData.data, financeData.isLoading]);

    // Вычисляем состояние смены
    const shift = financeData.data?.shift ?? null;
    const isOpen = shift?.status === 'open';
    const isClosed = shift?.status === 'closed';

    // Для владельца: режим только для чтения, если смена закрыта
    const isReadOnlyForOwner = !!staffId && isClosed;

    // Расчеты финансов
    const calculations = useShiftCalculations(
        localItems,
        shift,
        isOpen ?? false,
        financeData.data?.staffPercentMaster ?? 60,
        financeData.data?.staffPercentSalon ?? 40,
        financeData.data?.hourlyRate ?? null,
        financeData.data?.currentGuaranteedAmount ?? null
    );

    // Статистика
    const stats = useShiftStats({
        allShifts: financeData.data?.allShifts ?? [],
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    // Опции услуг
    const serviceOptions = useServiceOptions(
        financeData.data?.services ?? [],
        financeData.data?.bookings ?? [],
        localItems
    );

    // Вычисляем общее количество закрытых смен
    const allClosedShiftsCount = useMemo(() => {
        const allShifts = financeData.data?.allShifts ?? [];
        return allShifts.filter((s) => s.status === 'closed').length;
    }, [financeData.data?.allShifts]);

    // Обработчики
    const handleOpenShift = useCallback(async () => {
        try {
            await mutations.openShift();
            // invalidateQueries в мутации автоматически вызовет refetch, дополнительный вызов не нужен
        } catch (error) {
            // Ошибка уже обработана в мутации
        }
    }, [mutations]);

    const handleCloseShift = useCallback(async () => {
        try {
            await mutations.closeShift(localItems);
            // invalidateQueries в мутации автоматически вызовет refetch, дополнительный вызов не нужен
        } catch (error) {
            // Ошибка уже обработана в мутации
        }
    }, [mutations, localItems]);

    const handleAddClient = useCallback(() => {
        const clientLabel = t('staff.finance.clients.client', 'Клиент');
        
        // Используем функциональное обновление для получения актуального состояния
        setLocalItems((prev) => {
            const existingClients = prev.filter((it) => !it.bookingId && it.clientName?.startsWith(`${clientLabel} `));
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

            const now = Date.now();
            const lastItemTime = prev.length > 0 && prev[0].createdAt
                ? new Date(prev[0].createdAt).getTime()
                : now;
            const timeOffset = (now - lastItemTime < 1000) ? 100 : 0;
            const createdAt = new Date(now + timeOffset).toISOString();

            const newItem: ShiftItem = {
                clientName: `${clientLabel} ${nextIndex}`,
                serviceName: '',
                serviceAmount: 0,
                consumablesAmount: 0,
                bookingId: null,
                createdAt,
            };

            // Добавляем новый элемент в начало массива
            const updatedItems = [newItem, ...prev];
            
            // Пропускаем следующую синхронизацию с сервером, чтобы не потерять новый элемент
            skipNextSyncRef.current = true;
            
            // Открываем форму для нового элемента (индекс 0) и сдвигаем остальные индексы
            setExpandedItems((expanded) => {
                const newExpanded = new Set([0]);
                // Сдвигаем все существующие открытые формы на +1
                expanded.forEach((idx) => {
                    newExpanded.add(idx + 1);
                });
                return newExpanded;
            });
            
            return updatedItems;
        });
    }, [t]);

    // Обновление элемента без сохранения на сервер (только локальное состояние)
    const handleUpdateItem = useCallback((idx: number, item: ShiftItem) => {
        // Только локальное обновление - без сохранения на сервер
        setLocalItems((prev) => prev.map((it, i) => (i === idx ? item : it)));
    }, []);

    // Явное сохранение элемента на сервер (при клике на кнопку "Сохранить")
    const handleSaveItem = useCallback(async (idx: number) => {
        const item = localItems[idx];
        if (!item) return;

        // Валидируем элемент перед сохранением
        const validation = validateShiftItem(item);
        
        if (!validation.valid) {
            // Если есть ошибки валидации, не сохраняем
            const errorMessages = Object.values(validation.errors).filter(Boolean);
            if (errorMessages.length > 0) {
                toast.showError(errorMessages[0]);
            } else {
                toast.showError(t('staff.finance.clients.validationError', 'Обнаружены ошибки валидации'));
            }
            return;
        }

        // Проверяем, есть ли данные для сохранения
        const hasData = item.id || 
            item.bookingId || 
            (item.serviceAmount && item.serviceAmount > 0) || 
            (item.consumablesAmount && item.consumablesAmount > 0) ||
            (item.serviceName && item.serviceName.trim() !== '') ||
            (item.clientName && item.clientName.trim() !== '' && !item.clientName.match(/^Клиент \d+$/));
        
        if (!hasData) {
            // Если нет данных, просто закрываем форму
            setExpandedItems((prev) => {
                const next = new Set(prev);
                next.delete(idx);
                return next;
            });
            return;
        }

        try {
            // Отмечаем, что этот элемент был сохранен (если он новый, без id)
            if (!item.id) {
                savedItemsWithoutIdRef.current.add(idx);
            }
            
            await mutations.saveItems(localItems);
            // После успешного сохранения закрываем форму
            // Если элемент был новым (без id), форма закроется после refetch через useEffect
            // Если элемент был существующим (с id), закрываем сразу
            if (item.id) {
                setExpandedItems((prev) => {
                    const next = new Set(prev);
                    next.delete(idx);
                    return next;
                });
            }
        } catch (error) {
            // При ошибке убираем из списка сохраненных
            savedItemsWithoutIdRef.current.delete(idx);
            // Ошибка уже обработана в мутации
        }
    }, [localItems, mutations, toast, t]);

    const handleDeleteItem = useCallback(async (idx: number) => {
        const itemToDelete = localItems[idx];
        
        // Оптимистичное удаление
        setLocalItems((prev) => prev.filter((_, i) => i !== idx));
        setExpandedItems((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return new Set(Array.from(next).map((i) => i > idx ? i - 1 : i));
        });

        // Удаляем на сервере
        try {
            const updatedItems = localItems.filter((_, i) => i !== idx);
            await mutations.saveItems(updatedItems);
            // invalidateQueries в мутации автоматически вызовет refetch
        } catch (error) {
            // Откатываем при ошибке
            setLocalItems((prev) => {
                const result = [...prev];
                result.splice(idx, 0, itemToDelete);
                return result;
            });
        }
    }, [localItems, mutations]);

    // Определяем, нужно ли показывать индикатор загрузки
    const shouldShowLoading = financeData.isLoading || mutations.isOpening || mutations.isClosing || mutations.isSaving;

    return (
        <>
            {shouldShowLoading && (
                <LoadingOverlay
                    message={mutations.isClosing 
                        ? t('staff.finance.shift.closing', 'Закрытие смены...')
                        : t('staff.finance.loading', 'Загрузка данных смены...')}
                />
            )}
            <ToastContainer
                toasts={toast.toasts}
                onRemove={toast.removeToast}
            />
            
            {/* Заголовок */}
            {showHeader && !staffId && (
                <div className="mb-6 px-6 pt-6">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {t('staff.finance.title', 'Финансы')}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('staff.finance.subtitle', 'Управление сменой, клиентами и тем, сколько получает сотрудник и бизнес')}
                    </p>
                </div>
            )}

            <div className={staffId ? '' : 'px-6'}>
                <Tabs
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    itemsCount={localItems.length}
                    showStats={!!stats && !staffId}
                />
            </div>

            {/* Таб: Текущая смена */}
            {activeTab === 'shift' && (
                <div className={`space-y-4 ${staffId ? 'p-6' : 'px-6 pb-6'}`}>
                    {financeData.isError && financeData.error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                        {t('staff.finance.error.title', 'Ошибка загрузки данных')}
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                        {financeData.error.message}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void financeData.refetch()}
                                        className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                                    >
                                        {t('staff.finance.error.retry', 'Попробовать снова')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <ShiftHeader
                            shiftDate={shiftDate}
                            onShiftDateChange={setShiftDate}
                            shift={shift}
                            isOpen={isOpen ?? false}
                            staffId={staffId}
                        />
                        <ShiftControls
                            hasShift={!!shift}
                            isOpen={isOpen ?? false}
                            isClosed={isClosed ?? false}
                            isDayOff={financeData.data?.isDayOff ?? false}
                            loading={financeData.isLoading}
                            saving={mutations.isOpening || mutations.isClosing}
                            staffId={staffId}
                            onOpenShift={handleOpenShift}
                            onCloseShift={handleCloseShift}
                            onRefresh={() => void financeData.refetch()}
                        />
                    </div>

                    {shift && (
                        <ShiftSummary
                            calculations={calculations}
                            shift={shift}
                            isOpen={isOpen ?? false}
                            hourlyRate={financeData.data?.hourlyRate ?? null}
                            currentHoursWorked={financeData.data?.currentHoursWorked ?? null}
                            currentGuaranteedAmount={financeData.data?.currentGuaranteedAmount ?? null}
                        />
                    )}

                    {showShiftDetails && shift && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid sm:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                        {t('staff.finance.details.composition', 'Состав оборота')}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.details.serviceAmount', 'Услуги')}</span>
                                            <span className="font-semibold">{calculations.totalAmount.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.details.consumables', 'Расходники')}</span>
                                            <span className="font-semibold text-amber-600 dark:text-amber-400">{calculations.totalConsumables.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-medium">
                                            <span>{t('staff.finance.details.total', 'Итого')}</span>
                                            <span>{(calculations.totalAmount + calculations.totalConsumables).toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                        {t('staff.finance.details.distribution', 'Распределение')}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                {t('staff.finance.details.staffShare', 'Сотрудник')} <span className="text-xs">({financeData.data?.staffPercentMaster ?? 60}%)</span>
                                            </span>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{calculations.masterShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                {t('staff.finance.details.businessShare', 'Бизнес')} <span className="text-xs">({financeData.data?.staffPercentSalon ?? 40}% + расходники)</span>
                                            </span>
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{calculations.salonShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowShiftDetails(false)}
                                className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {t('staff.finance.shift.hideDetails', 'Скрыть детали')}
                            </button>
                        </div>
                    )}
                    
                    {shift && !showShiftDetails && (
                        <button
                            type="button"
                            onClick={() => setShowShiftDetails(true)}
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            {t('staff.finance.shift.showDetails', 'Показать детали расчета')}
                        </button>
                    )}
                </div>
            )}

            {/* Таб: Клиенты */}
            {activeTab === 'clients' && (
                <div className={`space-y-4 ${staffId ? 'p-6' : 'px-6 pb-6'}`}>
                    <ClientsListHeader
                        shiftDate={shiftDate}
                        onShiftDateChange={setShiftDate}
                        isOpen={isOpen ?? false}
                        isClosed={isClosed ?? false}
                        isReadOnly={isReadOnlyForOwner}
                        savingItems={mutations.isSaving}
                        saving={mutations.isOpening || mutations.isClosing}
                        staffId={staffId}
                        onAddClient={handleAddClient}
                    />

                    <ClientsList
                        items={localItems}
                        bookings={financeData.data?.bookings ?? []}
                        serviceOptions={serviceOptions}
                        shift={shift}
                        isOpen={isOpen ?? false}
                        isClosed={isClosed ?? false}
                        isReadOnly={isReadOnlyForOwner}
                        staffId={staffId}
                        expandedItems={expandedItems}
                        onExpand={(idx) => setExpandedItems((prev) => new Set(prev).add(idx))}
                        onCollapse={(idx) => {
                            setExpandedItems((prev) => {
                                const next = new Set(prev);
                                next.delete(idx);
                                return next;
                            });
                        }}
                        onUpdateItem={handleUpdateItem}
                        onSaveItem={handleSaveItem}
                        onDeleteItem={handleDeleteItem}
                    />
                </div>
            )}

            {/* Таб: Статистика */}
            {activeTab === 'stats' && stats && !staffId && (
                <div className={`${staffId ? 'p-6' : 'px-6 pb-6'}`}>
                    <StatsView
                        stats={stats}
                        allShiftsCount={allClosedShiftsCount}
                        statsPeriod={statsPeriod}
                        onPeriodChange={setStatsPeriod}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        selectedMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                        selectedYear={selectedYear}
                        onYearChange={setSelectedYear}
                    />
                </div>
            )}
        </>
    );
});

