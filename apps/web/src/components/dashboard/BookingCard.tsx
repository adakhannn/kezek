/**
 * BookingCard - карточка бронирования для операторских экранов
 * 
 * Использует единые токены для стилей и цветов статусов
 */

'use client';

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { bookingStatusColors, BookingStatus } from './tokens';
import { clsx } from 'clsx';

interface BookingCardProps {
    id: string;
    startISO: string;
    endISO: string;
    status: BookingStatus;
    timezone: string;
    href?: string;
    className?: string;
    onClick?: () => void;
}

export function BookingCard({
    id,
    startISO,
    endISO,
    status,
    timezone,
    href,
    className,
    onClick,
}: BookingCardProps) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const label = `${formatInTimeZone(start, timezone, 'HH:mm')}–${formatInTimeZone(end, timezone, 'HH:mm')}`;
    
    const statusStyles = bookingStatusColors[status];
    const baseStyles = clsx(
        'inline-block text-xs px-2 py-1 border rounded-lg font-medium',
        statusStyles.bg,
        statusStyles.text,
        statusStyles.border,
        'hover:opacity-90 transition-opacity',
        className
    );

    const title = `Открыть бронь #${id.slice(0, 8)}`;

    if (href) {
        return (
            <Link href={href} onClick={onClick} className={baseStyles} title={title}>
                {label}
            </Link>
        );
    }

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={baseStyles} title={title}>
                {label}
            </button>
        );
    }

    return (
        <span className={baseStyles} title={title}>
            {label}
        </span>
    );
}
