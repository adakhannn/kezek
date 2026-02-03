'use client';

import type { Biz } from '../types';

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
                {biz.rating_score !== null && biz.rating_score !== undefined && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                            {biz.rating_score.toFixed(1)}
                        </span>
                    </div>
                )}
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

