type BookingCardActionsProps = {
    bookingId: string;
    canCancel: boolean;
    busy: boolean;
    reviewSubmitting: boolean;
    hasReview: boolean;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    canRepeat: boolean;
    reviewRating?: number;
    onOpenMap: () => void;
    onCancel: () => void;
    onOpenReview: () => void;
    onRepeat: () => void;
    t: (key: string, fallback?: string) => string;
};

export function BookingCardActions({
    bookingId,
    canCancel,
    busy,
    reviewSubmitting,
    hasReview,
    status,
    canRepeat,
    reviewRating,
    onOpenMap,
    onCancel,
    onOpenReview,
    onRepeat,
    t,
}: BookingCardActionsProps) {
    return (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <a
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                href={`/booking/${bookingId}`}
                target="_blank"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {t('cabinet.bookings.card.actions.open', 'Открыть')}
            </a>
            <button
                className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={onOpenMap}
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('cabinet.bookings.card.actions.onMap', 'На карте')}
            </button>
            {canCancel && (
                <button
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                    onClick={onCancel}
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {busy ? t('cabinet.bookings.card.actions.cancelling', 'Отмена...') : t('cabinet.bookings.card.actions.cancel', 'Отменить')}
                </button>
            )}
            {!canCancel && !hasReview && status !== 'cancelled' && (
                <button
                    disabled={reviewSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-yellow-900/20 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                    onClick={onOpenReview}
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {t('cabinet.bookings.card.actions.review', 'Оставить отзыв')}
                </button>
            )}
            {!canCancel && hasReview && status !== 'cancelled' && (
                <button
                    className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
                    onClick={onOpenReview}
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('cabinet.bookings.card.actions.editReview', 'Редактировать отзыв ({rating}★)').replace('{rating}', String(reviewRating ?? ''))}
                </button>
            )}
            {canRepeat && (
                <button
                    type="button"
                    onClick={onRepeat}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-indigo-700 hover:to-pink-700 hover:shadow-md"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('cabinet.bookings.card.actions.repeat', 'Повторить')}
                </button>
            )}
        </div>
    );
}
