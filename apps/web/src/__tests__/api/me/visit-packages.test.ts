import { GET } from '@/app/api/me/visit-packages/route';
import {
  createMockRequest,
  createMockSupabase,
  expectErrorResponse,
  expectSuccessResponse,
  setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseClients: jest.fn(),
}));

import { createSupabaseClients } from '@/lib/supabaseHelpers';

describe('/api/me/visit-packages', () => {
  const supabase = createMockSupabase();
  const admin = createMockSupabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when user is not authenticated', async () => {
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
      },
      admin,
    });

    const res = await GET(createMockRequest('http://localhost/api/me/visit-packages', { method: 'GET' }));
    await expectErrorResponse(res, 401, 'auth');
  });

  test('returns active visit packages for current user', async () => {
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      },
      admin,
    });

    admin.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        gt: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'pkg-1',
              client_id: 'user-1',
              plan_id: 'plan-1',
              remaining_visits: 2,
              valid_until: '2026-12-31',
              purchased_at: '2026-01-01T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'plan-1',
              name_ru: 'Пакет',
              name_ky: null,
              name_en: null,
              visit_count: 5,
            },
          ],
        }),
      });

    const res = await GET(createMockRequest('http://localhost/api/me/visit-packages', { method: 'GET' }));
    const body = await expectSuccessResponse(res, 200);

    expect(body.data.packages).toHaveLength(1);
    expect(body.data.packages[0]).toHaveProperty('plan_name_ru', 'Пакет');
  });
});
