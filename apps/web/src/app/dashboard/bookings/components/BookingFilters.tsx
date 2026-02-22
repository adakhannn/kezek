/**
 * Компонент для фильтров списка бронирований
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { FilterPresets, FilterPreset } from './FilterPresets';

type BranchRow = { id: string; name: string };

type BookingFiltersProps = {
    statusFilter: string;
    branchFilter: string;
    searchQuery: string;
    branches: BranchRow[];
    onStatusChange: (status: string) => void;
    onBranchChange: (branch: string) => void;
    onSearchChange: (query: string) => void;
    onRefresh: () => void;
    isLoading: boolean;
    // Пресеты
    activePreset?: FilterPreset;
    onPresetChange?: (preset: FilterPreset) => void;
    timezone: string;
    currentStaffId?: string | null;
    hasStaffAccess?: boolean;
};

export function BookingFilters({
    statusFilter,
    branchFilter,
    searchQuery,
    branches,
    onStatusChange,
    onBranchChange,
    onSearchChange,
    onRefresh,
    isLoading,
    activePreset,
    onPresetChange,
    timezone,
    currentStaffId,
    hasStaffAccess,
}: BookingFiltersProps) {
    const { t } = useLanguage();

    return (
        <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                    {t('bookings.list.title', 'Брони')}
                </h2>
                <button
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center justify-center gap-2"
                    onClick={onRefresh}
                    disabled={isLoading}
                >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">{t('bookings.list.refresh', 'Обновить')}</span>
                    <span className="sm:hidden">{t('bookings.list.refresh', 'Обновить')}</span>
                </button>
            </div>
            {onPresetChange && (
                <FilterPresets
                    activePreset={activePreset || null}
                    onPresetChange={onPresetChange}
                    timezone={timezone}
                    currentStaffId={currentStaffId}
                    hasStaffAccess={hasStaffAccess}
                />
            )}
        </div>
    );
}

