/**
 * StatusPanel - панель статуса для операторских экранов
 * 
 * Использует единые токены для стилей
 */

'use client';

import { ReactNode } from 'react';
import { sizes, spacing } from './tokens';
import { clsx } from 'clsx';

interface StatusPanelProps {
    title: string;
    loading?: boolean;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function StatusPanel({
    title,
    loading = false,
    actions,
    children,
    className,
}: StatusPanelProps) {
    return (
        <div className={clsx(
            'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800',
            className
        )}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                </h3>
                {actions && (
                    <div className="flex gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
            ) : (
                children
            )}
        </div>
    );
}

interface StatusItemProps {
    label: string;
    value: string | number;
    subtitle?: string;
    className?: string;
}

export function StatusItem({
    label,
    value,
    subtitle,
    className,
}: StatusItemProps) {
    return (
        <div className={clsx(
            'bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700',
            className
        )}>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {label}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {value}
            </div>
            {subtitle && (
                <div className="text-xs text-indigo-600 dark:text-indigo-400">
                    {subtitle}
                </div>
            )}
        </div>
    );
}

