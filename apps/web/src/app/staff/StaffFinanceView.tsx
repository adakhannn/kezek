'use client';

import { useState, useMemo, useCallback, useRef } from 'react';

import { ClientsList } from './finance/components/ClientsList';
import { ClientsListHeader } from './finance/components/ClientsListHeader';
import { ShiftControls } from './finance/components/ShiftControls';
import { ShiftHeader } from './finance/components/ShiftHeader';
import { ShiftSummary } from './finance/components/ShiftSummary';
import { StatsView } from './finance/components/StatsView';
import { Tabs } from './finance/components/Tabs';
import { useServiceOptions } from './finance/hooks/useServiceOptions';
import { useShiftCalculations } from './finance/hooks/useShiftCalculations';
import { useShiftData } from './finance/hooks/useShiftData';
import { useShiftItems } from './finance/hooks/useShiftItems';
import { useShiftManagement } from './finance/hooks/useShiftManagement';
import { useShiftStats } from './finance/hooks/useShiftStats';
import type { TabKey, PeriodKey } from './finance/types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { LoadingOverlay } from '@/components/ui/ProgressBar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { todayTz } from '@/lib/time';

// Импортируем типы

// Импортируем хуки

// Импортируем компоненты

export default function StaffFinanceView({ staffId }: { staffId?: string }) {
    const { t } = useLanguage();
    const toast = useToast();
    
    // Состояние для вкладок и дат
    const [activeTab, setActiveTab] = useState<TabKey>(staffId ? 'clients' : 'shift');
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [shiftDate, setShiftDate] = useState<Date>(todayTz());
    const [selectedDate, setSelectedDate] = useState<Date>(todayTz());
    const [selectedMonth, setSelectedMonth] = useState<Date>(todayTz());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showShiftDetails, setShowShiftDetails] = useState(false);

    // Мемоизируем callback для onDataLoaded, чтобы избежать пересоздания load
    const handleDataLoaded = useCallback(() => {
        // Данные загружены
    }, []);
    
    // Загрузка данных смены
    const shiftData = useShiftData({ 
        staffId, 
        shiftDate,
        onDataLoaded: handleDataLoaded
    });

    // Управление сменой
    const shiftManagement = useShiftManagement(() => {
        void shiftData.load();
    });

    // Вычисляем состояние смены с улучшенными проверками на null/undefined
    const todayShift = shiftData.today && 
        shiftData.today.ok && 
        shiftData.today.today && 
        shiftData.today.today.exists && 
        shiftData.today.today.shift
        ? shiftData.today.today.shift 
        : null;
    const isOpen = !!(todayShift && todayShift.status === 'open');
    const isClosed = !!(todayShift && todayShift.status === 'closed');

    // Управление клиентами
    // Для владельца: режим только для чтения, если смена закрыта
    // Владелец может редактировать открытые смены сотрудников (даже если смена еще не создана, он может её открыть)
    // Если staffId не передан, это сотрудник редактирует свою смену - всегда может редактировать открытые смены
    // Владелец НЕ может редактировать только закрытые смены
    const isReadOnlyForOwner = !!staffId && isClosed;
    
    // Мемоизируем callback для предотвращения бесконечных циклов
    // Используем ref для предотвращения повторных вызовов во время загрузки
    const isLoadingRef = useRef(false);
    const handleSaveSuccess = useCallback(() => {
        // Предотвращаем повторные вызовы, если уже идет загрузка
        if (isLoadingRef.current) {
            return;
        }
        isLoadingRef.current = true;
        // Перезагружаем данные после успешного сохранения, чтобы получить id для новых клиентов
        shiftData.load().finally(() => {
            isLoadingRef.current = false;
        });
    }, [shiftData]);
    
    const handleSaveError = useCallback((error: string) => {
        // Показываем ошибку пользователю
        toast.showError(error);
    }, [toast]);
    
    const shiftItems = useShiftItems({
        items: shiftData.items,
        isOpen,
        isReadOnly: isReadOnlyForOwner,
        isInitialLoad: shiftData.isInitialLoad,
        staffId,
        shiftDate,
        onSaveSuccess: handleSaveSuccess,
        onSaveError: handleSaveError,
    });

    // Расчеты финансов
    const calculations = useShiftCalculations(
        shiftItems.items,
        todayShift,
        isOpen,
        shiftData.staffPercentMaster,
        shiftData.staffPercentSalon,
        shiftData.hourlyRate,
        shiftData.currentGuaranteedAmount
    );

    // Статистика
    const stats = useShiftStats({
        allShifts: shiftData.allShifts,
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    // Опции услуг
    const serviceOptions = useServiceOptions(
        shiftData.availableServices,
        shiftData.bookings,
        shiftItems.items
    );

    // Вычисляем общее количество закрытых смен
    const allClosedShiftsCount = useMemo(() => {
        if (!shiftData.allShifts || shiftData.allShifts.length === 0) return 0;
        return shiftData.allShifts.filter((s) => s.status === 'closed').length;
    }, [shiftData.allShifts]);

    // Обработчики
    const handleOpenShift = async () => {
        await shiftManagement.handleOpenShift();
        await shiftData.load();
    };

    const handleCloseShift = async () => {
        await shiftManagement.handleCloseShift(shiftItems.items, () => {
            void shiftData.load();
        });
    };

    const handleAddClient = () => {
        // Проверяем, открыта ли смена
        // Для владельца: разрешаем добавление, если смена не закрыта (может быть открыта или еще не создана)
        // Для сотрудника: разрешаем добавление только если смена открыта
        if (staffId) {
            // Владелец: может добавлять клиентов, если смена не закрыта
            if (isClosed || isReadOnlyForOwner) {
                toast.showError(t('staff.finance.error.shiftClosed', 'Смена закрыта. Невозможно добавить клиента.'));
                return;
            }
        } else {
            // Сотрудник: может добавлять клиентов только если смена открыта
            if (!isOpen) {
                toast.showError(t('staff.finance.error.noOpenShift', 'Нет открытой смены. Сначала откройте смену.'));
                return;
            }
        }
        
        const clientLabel = t('staff.finance.clients.client', 'Клиент');
        const existingClients = shiftItems.items.filter((it) => !it.bookingId && it.clientName?.startsWith(`${clientLabel} `));
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
        
        // Устанавливаем время с небольшой задержкой относительно последнего добавленного клиента
        // чтобы обеспечить правильный порядок сортировки
        const now = Date.now();
        const lastItemTime = shiftItems.items.length > 0 && shiftItems.items[0].createdAt
            ? new Date(shiftItems.items[0].createdAt).getTime()
            : now;
        // Если последний клиент был добавлен недавно (в пределах 1 секунды), добавляем задержку
        const timeOffset = (now - lastItemTime < 1000) ? 100 : 0;
        const createdAt = new Date(now + timeOffset).toISOString();
        
        const newItem = {
            clientName: `${clientLabel} ${nextIndex}`,
            serviceName: '',
            serviceAmount: 0,
            consumablesAmount: 0,
            bookingId: null,
            createdAt,
        };
        shiftItems.setItems((prev) => [newItem, ...prev]);
        shiftItems.setExpandedItems(new Set([0]));
    };

    const handleUpdateItem = (idx: number, item: typeof shiftItems.items[0]) => {
        shiftItems.setItems((prev) => prev.map((it, i) => (i === idx ? item : it)));
    };

    const handleDeleteItem = (idx: number) => {
        // Проверяем, открыта ли смена
        // Для владельца: разрешаем удаление, если смена не закрыта (может быть открыта или еще не создана)
        // Для сотрудника: разрешаем удаление только если смена открыта
        if (staffId) {
            // Владелец: может удалять клиентов, если смена не закрыта
            if (isClosed || isReadOnlyForOwner) {
                toast.showError(t('staff.finance.error.shiftClosedDelete', 'Смена закрыта. Невозможно удалить клиента.'));
                return;
            }
        } else {
            // Сотрудник: может удалять клиентов только если смена открыта
            if (!isOpen) {
                toast.showError(t('staff.finance.error.noOpenShiftDelete', 'Нет открытой смены. Невозможно удалить клиента.'));
                return;
            }
        }
        
        shiftItems.setItems((prev) => prev.filter((_, i) => i !== idx));
        shiftItems.setExpandedItems((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
    };

    // Определяем, нужно ли показывать индикатор загрузки
    // Показываем при:
    // 1. Прогресс закрытия смены
    // 2. Начальной загрузке данных
    // 3. Последующих загрузках (но только если нет данных или произошла ошибка)
    const shouldShowLoading = shiftManagement.closingProgress?.show || 
        (shiftData.loading && (
            shiftData.isInitialLoad || 
            !shiftData.today || 
            (shiftData.today && !shiftData.today.ok)
        ));

    return (
        <>
            {shouldShowLoading && (
                <LoadingOverlay
                    message={shiftManagement.closingProgress?.message || t('staff.finance.loading', 'Загрузка данных смены...')}
                    progress={shiftManagement.closingProgress?.progress}
                    showProgress={shiftManagement.closingProgress?.progress !== undefined}
                />
            )}
            <ToastContainer
                toasts={toast.toasts}
                onRemove={toast.removeToast}
            />
            
            {/* Для владельца убираем заголовок и описание, так как они уже есть в StaffFinancePageClient */}
            {!staffId && (
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
                    onTabChange={setActiveTab}
                    itemsCount={shiftItems.items.length}
                    showStats={!!stats && !staffId}
                />
            </div>

            {/* Таб: Текущая смена */}
            {activeTab === 'shift' && (
                <div className={`space-y-4 ${staffId ? 'p-6' : 'px-6 pb-6'}`}>
                    {/* Показываем ошибку загрузки, если она есть и не идет загрузка */}
                    {!shiftData.loading && shiftData.today && !shiftData.today.ok && shiftData.today.error && (
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
                                        {shiftData.today.error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void shiftData.load()}
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
                            shift={todayShift}
                            isOpen={isOpen}
                            staffId={staffId}
                        />
                        <ShiftControls
                            hasShift={!!todayShift}
                            isOpen={isOpen}
                            isClosed={isClosed}
                            isDayOff={shiftData.isDayOff}
                            loading={shiftData.loading}
                            saving={shiftManagement.saving}
                            onOpenShift={handleOpenShift}
                            onCloseShift={handleCloseShift}
                            onRefresh={() => void shiftData.load()}
                        />
                    </div>

                    {todayShift && (
                        <ShiftSummary
                            calculations={calculations}
                            shift={todayShift}
                            isOpen={isOpen}
                            hourlyRate={shiftData.hourlyRate}
                            currentHoursWorked={shiftData.currentHoursWorked}
                            currentGuaranteedAmount={shiftData.currentGuaranteedAmount}
                        />
                    )}

                    {/* Дополнительные детали (раскрываются по кнопке) */}
                    {showShiftDetails && todayShift && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid sm:grid-cols-2 gap-6">
                                {/* Состав оборота */}
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

                                {/* Распределение */}
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                        {t('staff.finance.details.distribution', 'Распределение')}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                {t('staff.finance.details.staffShare', 'Сотрудник')} <span className="text-xs">({shiftData.staffPercentMaster}%)</span>
                                            </span>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{calculations.masterShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                {t('staff.finance.details.businessShare', 'Бизнес')} <span className="text-xs">({shiftData.staffPercentSalon}% + расходники)</span>
                                            </span>
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{calculations.salonShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                        </div>
                                        {isClosed && todayShift && typeof todayShift.topup_amount === 'number' && todayShift.topup_amount > 0 && (
                                            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <span className="text-xs text-amber-600 dark:text-amber-400">{t('staff.finance.details.ownerTopup', 'Доплата владельца')}</span>
                                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">+{todayShift.topup_amount.toFixed(2)} {t('staff.finance.shift.som', 'сом')}</span>
                                            </div>
                                        )}
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
                    
                    {todayShift && !showShiftDetails && (
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
                        isOpen={isOpen}
                        isClosed={isClosed}
                        savingItems={shiftItems.savingItems}
                        saving={shiftManagement.saving}
                        staffId={staffId}
                        onAddClient={handleAddClient}
                    />

                    <ClientsList
                        items={shiftItems.items}
                        bookings={shiftData.bookings}
                        serviceOptions={serviceOptions}
                        shift={todayShift}
                        isOpen={isOpen}
                        isReadOnly={isReadOnlyForOwner}
                        expandedItems={shiftItems.expandedItems}
                        onExpand={(idx) => shiftItems.setExpandedItems((prev) => new Set(prev).add(idx))}
                        onCollapse={(idx) => {
                            shiftItems.setExpandedItems((prev) => {
                                const next = new Set(prev);
                                next.delete(idx);
                                return next;
                            });
                        }}
                        onUpdateItem={handleUpdateItem}
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
}
