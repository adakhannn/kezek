'use client';

import { formatInTimeZone } from 'date-fns-tz';

import { TZ } from '@/lib/time';

import { getServiceName } from './staffDetailHelpers';
import type { Review } from './staffDetailTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function StaffReviewsSection({
    reviews,
    t,
}: {
    reviews: Review[];
    t: TranslationFn;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        {t('staff.detail.sections.reviews.title', 'Отзывы')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('staff.detail.sections.reviews.desc', 'Отзывы клиентов о работе сотрудника')}
                    </p>
                </div>
                {reviews.length > 0 && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5">
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{reviews.length}</span>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400">{t('staff.detail.reviews.count', 'отзывов')}</span>
                    </div>
                )}
            </div>
            {reviews.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">{t('staff.detail.reviews.empty', 'Пока нет отзывов')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => {
                        const dateStr = formatInTimeZone(new Date(review.start_at), TZ, 'dd.MM.yyyy HH:mm');
                        return (
                            <div key={review.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <svg
                                                        key={i}
                                                        className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{review.rating}★</span>
                                        </div>
                                        {review.service_name && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                {t('staff.detail.reviews.service', 'Услуга:')} <span className="font-medium">{getServiceName(review.service_name)}</span>
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-500">
                                            {dateStr} • {review.client_name || review.client_phone || t('staff.detail.reviews.client', 'Клиент')}
                                        </p>
                                    </div>
                                </div>
                                {review.comment && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{review.comment}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
