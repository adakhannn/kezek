'use client';

import { clsx } from 'clsx';
import { HTMLAttributes, forwardRef } from 'react';
import type React from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
    hover?: boolean;
}

const CardComponent = (
    { className, variant = 'default', hover = false, children, ...props }: CardProps,
    ref: React.ForwardedRef<HTMLDivElement>
) => {
    const baseStyles = 'rounded-xl transition-all duration-300';
    
    const variants: Record<'default' | 'elevated' | 'outlined' | 'glass', string> = {
        default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800',
        elevated: 'bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl',
        outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-700',
        glass: 'glass backdrop-blur-md',
    };
    
    const hoverStyles = hover ? 'hover:scale-[1.02] hover:shadow-xl cursor-pointer' : '';
    
    return (
        <div
            ref={ref}
            className={clsx(baseStyles, variants[variant], hoverStyles, className)}
            {...props}
        >
            {children}
        </div>
    );
};

export const Card = forwardRef<HTMLDivElement, CardProps>(CardComponent);

Card.displayName = 'Card';


