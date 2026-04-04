'use client';

import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
    circle?: boolean;
};

export function Skeleton({ className, circle = false, ...props }: SkeletonProps) {
    return (
        <div
            className={clsx(
                'animate-pulse bg-[color:color-mix(in_srgb,var(--surface-emphasis)_86%,var(--surface-card))]',
                circle ? 'rounded-full' : 'rounded-[var(--radius-md)]',
                className,
            )}
            {...props}
        />
    );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={clsx('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    className={clsx('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')}
                />
            ))}
        </div>
    );
}
