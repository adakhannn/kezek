/**
 * ShiftCard - карточка смены для операторских экранов
 * 
 * Использует единые токены для стилей и цветов статусов
 */

'use client';

import { useState, ReactNode } from 'react';
import { shiftStatusColors, ShiftStatus, sizes, spacing } from './tokens';
import { clsx } from 'clsx';

interface ShiftCardProps {
    shiftDate: string;
    status: ShiftStatus;
    totalAmount: number;
    clientCount?: number;
    openedAt?: string;
    locale?: string;
    children?: ReactNode;
    onExpand?: (expanded: boolean) => void;
    className?: string;
}

export function ShiftCard({
    shiftDate,
    status,
    totalAmount,
    clientCount,
    openedAt,
    locale = 'ru',
    children,
    onExpand,
    className,
}: ShiftCardProps) {
    const [isExpanded, setIsExpanded] = useState(status === 'open');
    
    const statusStyles = shiftStatusColors[status];
    
    const handleToggle = () => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        onExpand?.(newExpanded);
    };

    return (
        <div className={clsx(
            'bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
            className
        )}>
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={handleToggle}
            >
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {shiftDate}
                        </span>
                        <span
                            className={clsx(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                statusStyles.bg,
                                statusStyles.text
                            )}
                        >
                            {status === 'open' ? 'Открыта' : 'Закрыта'}
                        </span>
                        {clientCount !== undefined && clientCount > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({clientCount} клиентов)
                            </span>
                        )}
                    </div>
                    {openedAt && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Открыта: {openedAt}
                        </div>
                    )}
                </div>
                <div className="text-right mr-4 min-w-[160px]">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                        {totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                </div>
                <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggle();
                    }}
                >
                    <svg
                        className={clsx(
                            'w-5 h-5 transition-transform',
                            isExpanded && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {isExpanded && children && (
                <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <div className="p-3">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

