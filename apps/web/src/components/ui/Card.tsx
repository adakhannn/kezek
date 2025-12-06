'use client';

import { clsx } from 'clsx';
import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
    hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
        const baseStyles = 'rounded-xl transition-all duration-300';
        
        const variants = {
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
    }
);

Card.displayName = 'Card';

