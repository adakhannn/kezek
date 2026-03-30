type ReviewUpdateBody = {
    review_id?: string;
    rating?: number;
    comment?: string;
};

type ReviewUpdateFailure = {
    ok: false;
    status: 400 | 401 | 403 | 404;
    error: 'validation' | 'auth' | 'forbidden' | 'not_found';
    message: string;
};

type ReviewUpdateSuccess = {
    ok: true;
    payload: {
        id?: string;
    };
};

export type ReviewUpdateResult = ReviewUpdateFailure | ReviewUpdateSuccess;

export async function runReviewUpdate({
    supabase,
    body,
    now = new Date().toISOString(),
}: {
    supabase: any;
    body: ReviewUpdateBody;
    now?: string;
}): Promise<ReviewUpdateResult> {
    if (!body.review_id || !body.rating) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'review_id и rating обязательны',
        };
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        };
    }

    const userId = auth.user.id;
    const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .select('id, client_id, booking_id')
        .eq('id', body.review_id)
        .maybeSingle();

    if (reviewError || !review) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Отзыв не найден',
        };
    }

    if (review.client_id !== userId) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        };
    }

    const { data, error } = await supabase
        .from('reviews')
        .update({
            rating: body.rating,
            comment: body.comment ?? null,
            updated_at: now,
        })
        .eq('id', body.review_id)
        .select('id')
        .single();

    if (error) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: error.message,
        };
    }

    return {
        ok: true,
        payload: {
            id: data?.id,
        },
    };
}
