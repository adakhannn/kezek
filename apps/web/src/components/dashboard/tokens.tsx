/**
 * Design tokens для операторских компонентов дашборда
 *
 * Единые токены для отступов, размеров, иконок и цветов статусов,
 * используемые по всем экранам дашборда
 */

import type { ReactNode } from 'react';

// Отступы (spacing)
export const spacing = {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    '2xl': '2rem',    // 32px
    '3xl': '3rem',    // 48px
} as const;

// Размеры компонентов
export const sizes = {
    // Карточки
    cardPadding: spacing.lg,
    cardGap: spacing.md,
    cardBorderRadius: '0.75rem', // 12px

    // Кнопки
    buttonHeight: {
        sm: '2rem',   // 32px
        md: '2.5rem', // 40px
        lg: '3rem',   // 48px
    },
    buttonPadding: {
        sm: `${spacing.sm} ${spacing.md}`,
        md: `${spacing.md} ${spacing.lg}`,
        lg: `${spacing.lg} ${spacing.xl}`,
    },

    // Иконки
    iconSize: {
        xs: '0.875rem', // 14px
        sm: '1rem',     // 16px
        md: '1.25rem',  // 20px
        lg: '1.5rem',   // 24px
    },

    // Текст
    fontSize: {
        xs: '0.75rem',  // 12px
        sm: '0.875rem', // 14px
        md: '1rem',     // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem',  // 20px
        '2xl': '1.5rem', // 24px
    },

    // Панели
    panelPadding: spacing.lg,
    panelGap: spacing.md,
    panelBorderRadius: '0.5rem', // 8px
} as const;

// Цвета статусов бронирований
export const bookingStatusColors = {
    hold: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-800 dark:text-yellow-400',
        border: 'border-yellow-300 dark:border-yellow-800',
    },
    confirmed: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-800 dark:text-blue-400',
        border: 'border-blue-300 dark:border-blue-800',
    },
    paid: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-800 dark:text-green-400',
        border: 'border-green-300 dark:border-green-800',
    },
    cancelled: {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-700',
    },
    no_show: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-800 dark:text-red-400',
        border: 'border-red-300 dark:border-red-800',
    },
} as const;

// Цвета статусов смен
export const shiftStatusColors = {
    open: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
    },
    closed: {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-700 dark:text-gray-300',
    },
} as const;

// Иконки статусов (SVG paths)
const pathHold = <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />;
const pathCheck = <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />;

export const statusIcons: Record<string, ReactNode> = {
    hold: pathHold,
    confirmed: pathCheck,
    paid: pathCheck,
    cancelled: pathHold,
    no_show: pathHold,
    open: pathCheck,
    closed: pathHold,
};

// Типы статусов
export type BookingStatus = keyof typeof bookingStatusColors;
export type ShiftStatus = keyof typeof shiftStatusColors;
