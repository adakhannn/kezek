import { runReviewUpdateHttp } from '@/lib/reviewUpdateHttpService';

jest.mock('@/lib/reviewUpdateService', () => ({
    runReviewUpdate: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

import { runReviewUpdate } from '@/lib/reviewUpdateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('reviewUpdateHttpService', () => {
    const mockSupabase = { auth: { getUser: jest.fn() } };

    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    test('delegates valid request to review update service', async () => {
        (runReviewUpdate as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { id: 'review-id' },
        });

        const response = await runReviewUpdateHttp(
            new Request('http://localhost/api/reviews/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    review_id: 'review-id',
                    rating: 5,
                    comment: 'Great',
                }),
            }),
        );
        const body = await response.json();

        expect(runReviewUpdate).toHaveBeenCalledWith({
            supabase: mockSupabase,
            body: {
                review_id: 'review-id',
                rating: 5,
                comment: 'Great',
            },
        });
        expect(response.status).toBe(200);
        expect(body.data.id).toBe('review-id');
    });

    test('maps service validation errors', async () => {
        (runReviewUpdate as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'validation',
            message: 'review_id required',
            status: 400,
        });

        const response = await runReviewUpdateHttp(
            new Request('http://localhost/api/reviews/update', {
                method: 'POST',
                body: JSON.stringify({}),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });
});

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({ kind: 'bearer-client' })),
}));

describe('reviewUpdateHttpService with the mobile Bearer token (C9)', () => {
    test('the update runs as the token user', async () => {
        jest.clearAllMocks();
        (runReviewUpdate as jest.Mock).mockResolvedValue({ ok: true, payload: { id: 'review-id' } });

        const response = await runReviewUpdateHttp(
            new Request('http://localhost/api/reviews/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json', Authorization: 'Bearer app-token' },
                body: JSON.stringify({ review_id: 'review-id', rating: 3 }),
            }),
        );

        expect(response.status).toBe(200);
        expect(runReviewUpdate).toHaveBeenCalledWith({
            supabase: { kind: 'bearer-client' },
            body: { review_id: 'review-id', rating: 3 },
        });
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
    });
});
