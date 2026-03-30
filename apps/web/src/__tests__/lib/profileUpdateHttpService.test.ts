jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/profileUpdateService', () => ({
  updateProfileSettings: jest.fn(),
}));

import { updateProfileSettings } from '@/lib/profileUpdateService';
import { runProfileUpdateHttp } from '@/lib/profileUpdateHttpService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('profileUpdateHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn() }, from: jest.fn() });
  });

  test('delegates valid request to profile update service', async () => {
    (updateProfileSettings as jest.Mock).mockResolvedValue({ ok: true, data: undefined });

    const response = await runProfileUpdateHttp(
      new Request('http://localhost/api/profile/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: 'Ada' }),
      }),
    );
    const body = await response.json();

    expect(updateProfileSettings).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      body: { full_name: 'Ada' },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('maps service validation errors', async () => {
    (updateProfileSettings as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'validation',
      message: 'bad phone',
      status: 400,
    });

    const response = await runProfileUpdateHttp(
      new Request('http://localhost/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({ phone: 'bad' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
