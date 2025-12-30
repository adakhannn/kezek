// apps/web/src/app/cabinet/ClientCabinet.tsx
'use client';

import {useState} from 'react';

import BookingCard from './components/BookingCard';

type Booking = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    services?: { name_ru: string; duration_min: number }[] | { name_ru: string; duration_min: number } | null;
    staff?: { full_name: string }[] | { full_name: string } | null;
    branches?: { name: string; lat: number | null; lon: number | null; address: string | null }[] | {
        name: string;
        lat: number | null;
        lon: number | null;
        address: string | null
    } | null;
    businesses?: { name: string; slug: string }[] | { name: string; slug: string } | null;
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
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Мои записи</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {tab === 'upcoming' 
                                ? `У вас ${upcoming.length} ${upcoming.length === 1 ? 'предстоящая запись' : upcoming.length < 5 ? 'предстоящие записи' : 'предстоящих записей'}`
                                : `У вас ${past.length} ${past.length === 1 ? 'прошедшая запись' : past.length < 5 ? 'прошедшие записи' : 'прошедших записей'}`
                            }
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
                            Предстоящие
                        </button>
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                tab === 'past'
                                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                            onClick={() => setTab('past')}
                        >
                            Прошедшие
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
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Нет предстоящих записей</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Запишитесь на услугу, чтобы увидеть её здесь</p>
                                <a
                                    href="/"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                    Найти услугу
                                </a>
                            </div>
                        ) : (
                            upcoming.map(b => (
                                <BookingCard
                                    key={b.id}
                                    bookingId={b.id}
                                    status={b.status}
                                    start_at={b.start_at}
                                    end_at={b.end_at}
                                    service={first(b.services)}
                                    staff={first(b.staff)}
                                    branch={first(b.branches)}
                                    business={first(b.businesses)}
                                    review={extractReview(b.reviews)}
                                    canCancel
                                />
                            ))
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
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Нет прошедших записей</h3>
                                <p className="text-gray-500 dark:text-gray-400">Здесь будут отображаться ваши завершённые записи</p>
                            </div>
                        ) : (
                            past.map(b => (
                                <BookingCard
                                    key={b.id}
                                    bookingId={b.id}
                                    status={b.status}
                                    start_at={b.start_at}
                                    end_at={b.end_at}
                                    service={first(b.services)}
                                    staff={first(b.staff)}
                                    branch={first(b.branches)}
                                    business={first(b.businesses)}
                                    review={extractReview(b.reviews)}
                                    canCancel={false}
                                />
                            ))
                        )}
                    </section>
                )}
        </div>
    );
}
