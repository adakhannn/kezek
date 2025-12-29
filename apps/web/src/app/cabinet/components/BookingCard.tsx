// apps/web/src/app/cabinet/components/BookingCard.tsx
'use client';

import {formatInTimeZone} from 'date-fns-tz';
import {useState} from 'react';

import MapDialog from './MapDialog';
import ReviewDialog from './ReviewDialog';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default function BookingCard({
                                        bookingId, status, start_at, end_at,
                                        service, staff, branch, business,
                                        canCancel,
                                        review,
                                    }: {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    service: { name_ru: string; duration_min: number } | null;
    staff: { full_name: string } | null;
    branch: { name: string; lat: number | null; lon: number | null; address: string | null } | null;
    business: { name: string; slug: string } | null;
    canCancel: boolean;
    review?: { id: string; rating: number; comment: string | null } | null;
}) {
    const [showMap, setShowMap] = useState(false);
    const [openReview, setOpenReview] = useState(false);
    const [busy, setBusy] = useState(false);

    async function cancelBooking() {
        if (!confirm('Отменить запись?')) return;
        setBusy(true);
        try {
            const r = await fetch(`/api/bookings/${bookingId}/cancel`, {method: 'POST'});
            const j = await r.json();
            if (!j.ok) return alert(j.error || 'Не удалось отменить');
            location.reload();
        } finally {
            setBusy(false);
        }
    }

    const when = `${formatInTimeZone(new Date(start_at), TZ, 'dd.MM.yyyy HH:mm')} — ${formatInTimeZone(new Date(end_at), TZ, 'HH:mm')}`;
    
    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    const statusLabels = {
        hold: 'Ожидает подтверждения',
        confirmed: 'Подтверждена',
        paid: 'Оплачена',
        cancelled: 'Отменена',
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 sm:p-6 shadow-md border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-200">
            {/* Заголовок карточки */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                            <span className={`w-2 h-2 rounded-full ${
                                status === 'paid' ? 'bg-green-500' :
                                status === 'confirmed' ? 'bg-blue-500' :
                                status === 'hold' ? 'bg-yellow-500' :
                                'bg-red-500'
                            }`}></span>
                            {statusLabels[status]}
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {service?.name_ru || 'Услуга'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {staff?.full_name || 'Мастер не указан'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {business?.name} {branch?.name && `• ${branch.name}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Время */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{when}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{TZ}</div>
                </div>
            </div>

            {/* Действия */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <a
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors text-sm font-medium"
                    href={`/booking/${bookingId}`}
                    target="_blank"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Открыть
                </a>
                <button
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                    onClick={() => setShowMap(true)}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    На карте
                </button>
                {canCancel && (
                    <button
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={cancelBooking}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {busy ? 'Отмена...' : 'Отменить'}
                    </button>
                )}
                {!canCancel && !review && (
                    <button
                        className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors text-sm font-medium"
                        onClick={() => setOpenReview(true)}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        Оставить отзыв
                    </button>
                )}
                {!canCancel && review && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{review.rating}★</span>
                        {review.comment && <span className="text-xs">— "{review.comment}"</span>}
                    </div>
                )}
                {service && business && (
                    <a
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:from-indigo-700 hover:to-pink-700 transition-all text-sm font-medium shadow-sm hover:shadow-md"
                        href={`/b/${business.slug}?svc=${encodeURIComponent(service.name_ru)}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Повторить
                    </a>
                )}
            </div>

            {showMap && (
                <MapDialog
                    open={showMap}
                    onClose={() => setShowMap(false)}
                    lat={branch?.lat ?? null}
                    lon={branch?.lon ?? null}
                    title={`${business?.name ?? ''} — ${branch?.name ?? ''}`}
                    address={branch?.address ?? ''}
                />
            )}

            {openReview && (
                <ReviewDialog
                    bookingId={bookingId}
                    onClose={() => setOpenReview(false)}
                />
            )}
        </div>
    );
}
