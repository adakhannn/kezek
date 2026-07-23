import {
  updateProfileSettings,
  type ProfileUpdateSupabaseLike,
} from '@/lib/profileUpdateService';

describe('profileUpdateService', () => {
  function createSupabase() {
    return {
      auth: {
        getUser: jest.fn(),
        updateUser: jest.fn(),
      },
      from: jest.fn(),
      rpc: jest.fn(),
    } as unknown as jest.Mocked<ProfileUpdateSupabaseLike>;
  }

  test('rejects anonymous user', async () => {
    const supabase = createSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const result = await updateProfileSettings({
      supabase,
      body: { full_name: 'Test User' },
    });

    expect(result).toEqual({
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    });
  });

  test('keeps whatsapp verification when contact phone changes', async () => {
    const supabase = createSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-id',
          user_metadata: {},
        },
      },
    });
    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { whatsapp_phone: '+996555123456', whatsapp_verified: true },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValue({
          error: null,
        }),
      });
    supabase.auth.updateUser.mockResolvedValue({
      error: null,
    });

    const result = await updateProfileSettings({
      supabase,
      body: {
        phone: '+996555999999',
      },
    });

    expect(result).toEqual({
      ok: true,
      data: undefined,
    });
  });

  test('includes telegram metadata in upsert when present', async () => {
    const supabase = createSupabase();
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-id',
          user_metadata: { telegram_id: 123456789 },
        },
      },
    });
    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { whatsapp_phone: null, whatsapp_verified: false },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        upsert,
      });
    supabase.auth.updateUser.mockResolvedValue({
      error: null,
    });

    await updateProfileSettings({
      supabase,
      body: { full_name: 'Updated Name' },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        telegram_id: 123456789,
        telegram_verified: true,
      }),
      { onConflict: 'id' },
    );
  });

  test('updates selected notification emails through the database invariant', async () => {
    const supabase = createSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-id',
          user_metadata: {},
        },
      },
    });
    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            whatsapp_phone: null,
            whatsapp_verified: false,
            telegram_id: null,
            telegram_verified: false,
          },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      });
    supabase.rpc.mockResolvedValue({ error: null });
    supabase.auth.updateUser.mockResolvedValue({ error: null });

    const result = await updateProfileSettings({
      supabase,
      body: {
        notify_email: true,
        notification_emails: ['google@example.com', 'yandex@example.com'],
      },
    });

    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_my_notification_email_preferences',
      {
        target_enabled: true,
        target_emails: ['google@example.com', 'yandex@example.com'],
      },
    );
  });
});
