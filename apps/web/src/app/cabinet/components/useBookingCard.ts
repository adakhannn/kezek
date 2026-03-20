import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useRef, useState } from 'react';

import { logError } from '@/lib/log';

type BookingCardReview = { id: string; rating: number; comment: string | null } | null | undefined;

type UseBookingCardArgs = {
    bookingId: string;
    businessSlug: string | null;
    startAt: string;
    timezone: string;
    effectiveBizId: string | null;
    effectiveBranchId: string | null;
    effectiveServiceId: string | null;
    effectiveStaffId: string | null;
    initialReview: BookingCardReview;
    t: (key: string, fallback?: string) => string;
};

export function useBookingCard({
    bookingId,
    businessSlug,
    startAt,
    timezone,
    effectiveBizId,
    effectiveBranchId,
    effectiveServiceId,
    effectiveStaffId,
    initialReview,
    t,
}: UseBookingCardArgs) {
    const [showMap, setShowMap] = useState(false);
    const [openReview, setOpenReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [review, setReview] = useState(initialReview);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setReview(initialReview);
    }, [initialReview]);

    useEffect(() => {
        return () => {
            if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
        };
    }, []);

    function repeatBooking() {
        if (!businessSlug) return;
        try {
            if (
                typeof window !== 'undefined' &&
                effectiveBizId &&
                effectiveBranchId &&
                effectiveServiceId &&
                effectiveStaffId
            ) {
                const key = `booking_state_${effectiveBizId}`;
                const payload = {
                    branchId: effectiveBranchId,
                    serviceId: effectiveServiceId,
                    staffId: effectiveStaffId,
                    day: formatInTimeZone(new Date(startAt), timezone, 'yyyy-MM-dd'),
                    step: 4,
                };
                window.localStorage.setItem(key, JSON.stringify(payload));
            }
        } catch (error) {
            logError('BookingCard', 'repeatBooking: failed to save state', error);
        }
        window.location.href = `/b/${businessSlug}`;
    }

    async function cancelBooking() {
        if (!confirm(t('cabinet.bookings.card.cancelConfirm', 'Отменить запись?'))) return;
        setBusy(true);
        try {
            const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
            const json = await response.json();
            if (!json.ok) {
                alert(json.error || t('cabinet.bookings.card.cancelError', 'Не удалось отменить'));
                return;
            }
            location.reload();
        } finally {
            setBusy(false);
        }
    }

    function handleReviewCreated(newReview: NonNullable<BookingCardReview>) {
        setReview(newReview);
        setOpenReview(false);
        setReviewSubmitting(false);
        if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = setTimeout(() => {
            window.location.reload();
        }, 300);
    }

    return {
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
    };
}
