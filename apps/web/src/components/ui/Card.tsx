'use client';

import { clsx } from 'clsx';
import { HTMLAttributes, forwardRef } from 'react';
import type React from 'react';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardStyleOptions {
    variant?: CardVariant;
    hover?: boolean;
    padding?: CardPadding;
    className?: string;
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    hover?: boolean;
    padding?: CardPadding;
}

const baseStyles = 'motion-interactive rounded-[var(--radius-lg)]';

const variants: Record<CardVariant, string> = {
    default: 'border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]',
    elevated: 'border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)]',
    outlined: 'border border-[var(--border-default)] bg-transparent',
    glass: 'border border-[var(--border-subtle)] bg-[var(--surface-overlay)] backdrop-blur-md shadow-[var(--shadow-md)]',
};

const paddings: Record<CardPadding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
};

export function cardStyles({
    variant = 'default',
    hover = false,
    padding = 'none',
    className,
}: CardStyleOptions = {}) {
    return clsx(
        baseStyles,
        variants[variant],
        paddings[padding],
        hover && 'motion-lift cursor-pointer hover:border-[var(--border-default)] hover:shadow-[var(--shadow-lg)]',
        className,
    );
}

const CardComponent = (
    { className, variant = 'default', hover = false, padding = 'none', children, ...props }: CardProps,
    ref: React.ForwardedRef<HTMLDivElement>,
) => {
    return (
        <div ref={ref} className={cardStyles({ variant, hover, padding, className })} {...props}>
            {children}
        </div>
    );
};

export const Card = forwardRef<HTMLDivElement, CardProps>(CardComponent);

Card.displayName = 'Card';
