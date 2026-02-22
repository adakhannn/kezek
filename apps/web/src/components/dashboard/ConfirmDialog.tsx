/**
 * ConfirmDialog - модальное окно подтверждения для операторских экранов
 * 
 * Использует единые токены для стилей
 */

'use client';

import { useEffect } from 'react';
import { sizes, spacing } from './tokens';
import { clsx } from 'clsx';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    className?: string;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    variant = 'info',
    onConfirm,
    onCancel,
    className,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            confirm: 'bg-red-600 hover:bg-red-700 text-white',
            border: 'border-red-200 dark:border-red-800',
        },
        warning: {
            confirm: 'bg-amber-600 hover:bg-amber-700 text-white',
            border: 'border-amber-200 dark:border-amber-800',
        },
        info: {
            confirm: 'bg-indigo-600 hover:bg-indigo-700 text-white',
            border: 'border-indigo-200 dark:border-indigo-800',
        },
    };

    const styles = variantStyles[variant];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className={clsx(
                    'bg-white dark:bg-gray-900 rounded-lg border shadow-xl max-w-md w-full',
                    styles.border,
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        {message}
                    </p>
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={clsx(
                                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                                styles.confirm
                            )}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

