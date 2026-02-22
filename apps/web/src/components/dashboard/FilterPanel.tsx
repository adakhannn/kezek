/**
 * FilterPanel - панель фильтров для операторских экранов
 * 
 * Использует единые токены для стилей
 */

'use client';

import { ReactNode } from 'react';
import { sizes, spacing } from './tokens';
import { clsx } from 'clsx';

interface FilterPanelProps {
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    filters?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export function FilterPanel({
    searchPlaceholder = 'Поиск...',
    searchValue,
    onSearchChange,
    filters,
    actions,
    className,
}: FilterPanelProps) {
    return (
        <div className={clsx(
            'bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800',
            'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
            className
        )}>
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
                {onSearchChange && (
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue || ''}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm flex-1"
                    />
                )}
                {filters && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {filters}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

interface FilterSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    className?: string;
}

export function FilterSelect({
    value,
    onChange,
    options,
    className,
}: FilterSelectProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={clsx(
                'px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm',
                className
            )}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

