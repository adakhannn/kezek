// apps/web/src/app/cabinet/ClientCabinet.tsx
'use client';

import {useState} from 'react';

import BookingCard from './components/BookingCard';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Booking = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    service_id?: string | null;
    staff_id?: string | null;
    branch_id?: string | null;
    biz_id?: string | null;
    services?: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[] | { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number } | null;
    staff?: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    branches?: { id: string; name: string; lat: number | null; lon: number | null; address: string | null }[] | {
        id: string;
        name: string;
        lat: number | null;
        lon: number | null;
        address: string | null
    } | null;
    businesses?: { id: string; name: string; slug: string }[] | { id: string; name: string; slug: string } | null;
    reviews?: { id: string; rating: number; comment: string | null }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

function extractReview(reviews: { id: string; rating: number; comment: string | null }[] | { id: string; rating: number; comment: string | null } | null | undefined): { id: string; rating: number; comment: string | null } | null {
    if (!reviews) return null;
    if (Array.isArray(reviews)) {
        return reviews.length > 0 ? reviews[0] : null;
    }
    // Если это объект (не массив), возвращаем его
    return reviews;
}

export default function ClientCabinet({
                                          userId,
                                          upcoming,
                                          past,
                                      }: {
    userId: string;
    upcoming: Booking[];
    past: Booking[];
}) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    const getSubtitle = () => {
        if (tab === 'upcoming') {
            const count = upcoming.length;
            if (count === 1) return t('cabinet.bookings.subtitle.upcoming', 'У вас {count} предстоящая запись').replace('{count}', String(count));
            if (count < 5) return t('cabinet.bookings.subtitle.upcoming', 'У вас {count} предстоящие записи').replace('{count}', String(count));
            return t('cabinet.bookings.subtitle.upcoming', 'У вас {count} предстоящих записей').replace('{count}', String(count));
        } else {
            const count = past.length;
            if (count === 1) return t('cabinet.bookings.subtitle.past', 'У вас {count} прошедшая запись').replace('{count}', String(count));
            if (count < 5) return t('cabinet.bookings.subtitle.past', 'У вас {count} прошедшие записи').replace('{count}', String(count));
            return t('cabinet.bookings.subtitle.past', 'У вас {count} прошедших записей').replace('{count}', String(count));
        }
    };

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {t('cabinet.bookings.title', 'Мои записи')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {getSubtitle()}
                        </p>
                    </div>
                    <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                tab === 'upcoming'
                                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                            onClick={() => setTab('upcoming')}
                        >
                            {t('cabinet.bookings.tabs.upcoming', 'Предстоящие')}
                        </button>
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                tab === 'past'
                                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                            onClick={() => setTab('past')}
                        >
                            {t('cabinet.bookings.tabs.past', 'Прошедшие')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Список бронирований */}
                {tab === 'upcoming' && (
                    <section className="space-y-4">
                        {upcoming.length === 0 ? (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    {t('cabinet.bookings.empty.upcoming.title', 'Нет предстоящих записей')}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">
                                    {t('cabinet.bookings.empty.upcoming.desc', 'Запишитесь на услугу, чтобы увидеть её здесь')}
                                </p>
                                <a
                                    href="/"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                    {t('cabinet.bookings.empty.upcoming.action', 'Найти услугу')}
                                </a>
                            </div>
                        ) : (
                            upcoming.map((b) => {
                                const service = first(b.services);
                                const staff = first(b.staff);
                                const branch = first(b.branches);
                                const business = first(b.businesses);
                                return (
                                    <BookingCard
                                        key={b.id}
                                        bookingId={b.id}
                                        status={b.status}
                                        start_at={b.start_at}
                                        end_at={b.end_at}
                                        service={service ? { id: service.id, name_ru: service.name_ru, name_ky: service.name_ky || null, name_en: service.name_en || null, duration_min: service.duration_min } : null}
                                        staff={staff ? { id: staff.id, full_name: staff.full_name } : null}
                                        branch={branch ? { id: branch.id, name: branch.name, lat: branch.lat, lon: branch.lon, address: branch.address } : null}
                                        business={business ? { id: business.id, name: business.name, slug: business.slug } : null}
                                        serviceId={b.service_id ?? service?.id}
                                        staffId={b.staff_id ?? staff?.id}
                                        branchId={b.branch_id ?? branch?.id}
                                        bizId={b.biz_id ?? business?.id}
                                        review={extractReview(b.reviews)}
                                        canCancel
                                    />
                                );
                            })
                        )}
                    </section>
                )}

                {tab === 'past' && (
                    <section className="space-y-4">
                        {past.length === 0 ? (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    {t('cabinet.bookings.empty.past.title', 'Нет прошедших записей')}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {t('cabinet.bookings.empty.past.desc', 'Здесь будут отображаться ваши завершённые записи')}
                                </p>
                            </div>
                        ) : (
                            past.map((b) => {
                                const service = first(b.services);
                                const staff = first(b.staff);
                                const branch = first(b.branches);
                                const business = first(b.businesses);
                                return (
                                    <BookingCard
                                        key={b.id}
                                        bookingId={b.id}
                                        status={b.status}
                                        start_at={b.start_at}
                                        end_at={b.end_at}
                                        service={service ? { id: service.id, name_ru: service.name_ru, name_ky: service.name_ky || null, name_en: service.name_en || null, duration_min: service.duration_min } : null}
                                        staff={staff ? { id: staff.id, full_name: staff.full_name } : null}
                                        branch={branch ? { id: branch.id, name: branch.name, lat: branch.lat, lon: branch.lon, address: branch.address } : null}
                                        business={business ? { id: business.id, name: business.name, slug: business.slug } : null}
                                        serviceId={b.service_id ?? service?.id}
                                        staffId={b.staff_id ?? staff?.id}
                                        branchId={b.branch_id ?? branch?.id}
                                        bizId={b.biz_id ?? business?.id}
                                        review={extractReview(b.reviews)}
                                        canCancel={false}
                                    />
                                );
                            })
                        )}
                    </section>
                )}
        </div>
    );
}
