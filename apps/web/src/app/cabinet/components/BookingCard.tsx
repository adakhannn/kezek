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
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    };

    const statusLabels = {
        hold: 'Удержано',
        confirmed: 'Подтверждено',
        paid: 'Оплачено',
        cancelled: 'Отменено',
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{business?.name}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                                    {statusLabels[status]}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mb-3">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {branch?.name}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="font-medium">{service?.name_ru}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{staff?.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{when}</span>
                        </div>
                    </div>

                    {review && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-yellow-500 text-lg">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Ваш отзыв</span>
                            </div>
                            {review.comment && (
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{review.comment}"</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-col sm:min-w-[140px]">
                    <a 
                        className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm text-center"
                        href={`/booking/${bookingId}`} 
                        target="_blank"
                    >
                        Открыть
                    </a>
                    <button 
                        className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm"
                        onClick={() => setShowMap(true)}
                    >
                        На карте
                    </button>
                    {canCancel && (
                        <button 
                            disabled={busy} 
                            className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-400 transition-all duration-200 text-sm disabled:opacity-50"
                            onClick={cancelBooking}
                        >
                            {busy ? 'Отмена...' : 'Отменить'}
                        </button>
                    )}
                    {!canCancel && !review && (
                        <button 
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                            onClick={() => setOpenReview(true)}
                        >
                            Отзыв
                        </button>
                    )}
                    {service && business && (
                        <a
                            className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 text-sm text-center"
                            href={`/b/${business.slug}?svc=${encodeURIComponent(service.name_ru)}`}
                        >
                            Повторить
                        </a>
                    )}
                </div>
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
