'use client';

import type { Biz } from '../types';

import { RatingDisplay } from '@/components/RatingDisplay';


type BookingHeaderProps = {
    biz: Biz;
    t: (key: string, fallback?: string) => string;
};

export function BookingHeader({ biz, t }: BookingHeaderProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {biz.name}
                </h1>
                <RatingDisplay score={biz.rating_score} t={t} variant="badge" className="px-3 py-1" />
            </div>
            {biz.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{biz.address}</p>
            )}
            {biz.phones?.length ? (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t('booking.phoneLabel', 'Телефон:')} {biz.phones.join(', ')}
                </p>
            ) : null}
        </div>
    );
}

