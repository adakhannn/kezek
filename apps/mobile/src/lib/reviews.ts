import type { ClientBookingReviewDto } from '@shared-client/types';

import { apiRequest } from './api';

type ReviewResponse = { ok?: boolean; data?: { id?: string } };

export type ReviewInput = {
    bookingId: string;
    rating: number;
    comment: string;
    /** The review being edited; a new review otherwise. */
    existingReviewId?: string | null;
};

/**
 * Leaves or edits the client's review of a visit, as the web cabinet does (ReviewDialog):
 * POST /api/reviews/create for a new one, /api/reviews/update for the author's own. Both accept
 * the app's Bearer token (C9); the server keeps the rule "own booking, paid, visit started".
 */
export async function submitReview({ bookingId, rating, comment, existingReviewId }: ReviewInput): Promise<ClientBookingReviewDto> {
    const trimmed = comment.trim();
    if (existingReviewId) {
        await apiRequest<ReviewResponse>('/reviews/update', {
            method: 'POST',
            body: JSON.stringify({ review_id: existingReviewId, rating, comment: trimmed }),
        });
        return { id: existingReviewId, rating, comment: trimmed || null };
    }

    const response = await apiRequest<ReviewResponse>('/reviews/create', {
        method: 'POST',
        body: JSON.stringify({ booking_id: bookingId, rating, comment: trimmed }),
    });
    return { id: String(response?.data?.id ?? ''), rating, comment: trimmed || null };
}

