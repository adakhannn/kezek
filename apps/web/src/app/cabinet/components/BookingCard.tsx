'use client';

import { buildBookingTimeline } from '@core-domain/booking';

import { BookingCardActions } from './BookingCardActions';
import { BookingCardHeader } from './BookingCardHeader';
import { BookingCardTimelineSection } from './BookingCardTimelineSection';
import MapDialog from './MapDialog';
import ReviewDialog from './ReviewDialog';
import {
    getBookingServiceName,
    getBookingStaffName,
    getBookingTimelineLabel,
    getBookingWhen,
} from './bookingCardHelpers';
import { useBookingCard } from './useBookingCard';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getBusinessTimezone } from '@/lib/time';

export default function BookingCard({
    bookingId,
    status,
    start_at,
    end_at,
    service,
    staff,
    branch,
    business,
    serviceId,
    staffId,
    branchId,
    bizId,
    canCancel,
    review: initialReview,
    promotionApplied,
    businessTz,
}: {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    service: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number } | null;
    staff: { id: string; full_name: string } | null;
    branch: { id: string; name: string; lat: number | null; lon: number | null; address: string | null } | null;
    business: { id: string; name: string; slug: string } | null;
    serviceId?: string | null;
    staffId?: string | null;
    branchId?: string | null;
    bizId?: string | null;
    canCancel: boolean;
    review?: { id: string; rating: number; comment: string | null } | null;
    promotionApplied?: Record<string, unknown> | null;
    servicesList?: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    subscriptionApplied?: Record<string, unknown> | null;
    businessTz?: string | null;
}) {
    const { t, locale } = useLanguage();
    const timezone = getBusinessTimezone(businessTz);

    const effectiveServiceId = serviceId ?? service?.id ?? null;
    const effectiveStaffId = staffId ?? staff?.id ?? null;
    const effectiveBranchId = branchId ?? branch?.id ?? null;
    const effectiveBizId = bizId ?? business?.id ?? null;

    const {
        busy,
        review,
        reviewSubmitting,
        showMap,
        openReview,
        setShowMap,
        setOpenReview,
        setReviewSubmitting,
        cancelBooking,
        repeatBooking,
        handleReviewCreated,
    } = useBookingCard({
        bookingId,
        businessSlug: business?.slug ?? null,
        startAt: start_at,
        timezone,
        effectiveBizId,
        effectiveBranchId,
        effectiveServiceId,
        effectiveStaffId,
        initialReview,
        t,
    });

    const serviceName = getBookingServiceName(service, locale, t);
    const staffName = getBookingStaffName(staff?.full_name, locale, t);
    const when = getBookingWhen(start_at, end_at, timezone, locale);
    const timelineSteps = buildBookingTimeline({
        status,
        hasPromotionApplied: !!promotionApplied,
    }).map((step) => ({
        ...step,
        label: getBookingTimelineLabel(step.key, t),
    }));

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-all duration-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <BookingCardHeader
                status={status}
                serviceName={serviceName}
                staffName={staffName}
                businessName={business?.name ?? null}
                branchName={branch?.name ?? null}
                t={t}
            />

            <BookingCardTimelineSection timelineSteps={timelineSteps} />

            {promotionApplied && typeof promotionApplied === 'object' && 'promotion_type' in promotionApplied && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <div className="flex items-start gap-2">
                        <svg className="mt-0.5 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <p className="mb-1 text-xs font-medium text-emerald-900 dark:text-emerald-100">
                                {t('cabinet.bookings.card.promotionApplied', 'Применена акция:')}
                            </p>
                            <p className="text-xs text-emerald-800 dark:text-emerald-200">
                                {String(promotionApplied.promotion_title || promotionApplied.promotion_type || '')}
                                {('discount_percent' in promotionApplied && promotionApplied.discount_percent) ? ` — ${String(promotionApplied.discount_percent)}%` : ''}
                                {('final_amount' in promotionApplied && promotionApplied.final_amount) ? (
                                    <span className="ml-2 font-semibold">
                                        {t('cabinet.bookings.card.finalAmount', 'Итоговая сумма:')} {String(promotionApplied.final_amount)} {t('booking.currency', 'сом')}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4 flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <svg className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{when}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{timezone}</div>
                </div>
            </div>

            {review && status !== 'cancelled' && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                    <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <svg
                                            key={index}
                                            className={`h-4 w-4 ${index < review.rating ? 'fill-current text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('cabinet.bookings.card.review.title', 'Ваш отзыв: {rating}★').replace('{rating}', String(review.rating))}
                                </span>
                            </div>
                            {review.comment && (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <BookingCardActions
                bookingId={bookingId}
                canCancel={canCancel}
                busy={busy}
                reviewSubmitting={reviewSubmitting}
                hasReview={!!review}
                status={status}
                canRepeat={!!service && !!business}
                reviewRating={review?.rating}
                onOpenMap={() => setShowMap(true)}
                onCancel={cancelBooking}
                onOpenReview={() => {
                    if (!review) {
                        setReviewSubmitting(true);
                    }
                    setOpenReview(true);
                }}
                onRepeat={repeatBooking}
                t={t}
            />

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
                    onClose={() => {
                        setOpenReview(false);
                        setReviewSubmitting(false);
                    }}
                    existingReview={review || null}
                    onReviewCreated={handleReviewCreated}
                />
            )}
        </div>
    );
}
