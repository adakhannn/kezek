jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/reviewCreateService', () => ({
  createOrUpdateReview: jest.fn(),
}));

import { createOrUpdateReview } from '@/lib/reviewCreateService';
import { runReviewCreateHttp } from '@/lib/reviewCreateHttpService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('reviewCreateHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn() }, from: jest.fn() });
  });

  test('delegates valid request to review create service', async () => {
    (createOrUpdateReview as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: 'review-id', updated: false },
    });

    const response = await runReviewCreateHttp(
      new Request('http://localhost/api/reviews/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ booking_id: 'booking-id', rating: 5 }),
      }),
    );
    const body = await response.json();

    expect(createOrUpdateReview).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      body: { booking_id: 'booking-id', rating: 5 },
    });
    expect(response.status).toBe(200);
    expect(body.data.id).toBe('review-id');
  });
});
