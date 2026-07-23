import { linkTelegramAccount, type TelegramLinkSupabaseLike } from '@/lib/telegramLinkService';
import { normalizeTelegramData, verifyTelegramAuth } from '@/lib/telegram/verify';

jest.mock('@/lib/telegram/verify', () => ({
  verifyTelegramAuth: jest.fn(),
  normalizeTelegramData: jest.fn(),
}));

describe('telegramLinkService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const telegramId = 123456789;

  function createAdmin() {
    return {
      from: jest.fn(),
      auth: {
        admin: {
          updateUserById: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<TelegramLinkSupabaseLike>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
    (normalizeTelegramData as jest.Mock).mockReturnValue({
      telegram_id: telegramId,
      full_name: 'Test User',
      telegram_username: 'testuser',
      telegram_photo_url: null,
    });
  });

  test('rejects invalid signature', async () => {
    const admin = createAdmin();
    (verifyTelegramAuth as jest.Mock).mockReturnValue(false);

    const result = await linkTelegramAccount({
      admin,
      user: { id: userId, user_metadata: {} },
      body: { id: telegramId, hash: 'bad', auth_date: Date.now() } as never,
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Неверная подпись данных Telegram',
      details: { code: 'invalid_signature' },
      status: 400,
    });
  });

  test('rejects already linked telegram account', async () => {
    const admin = createAdmin();
    admin.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'other-user-id', telegram_id: telegramId },
        error: null,
      }),
    }));

    const result = await linkTelegramAccount({
      admin,
      user: { id: userId, user_metadata: {} },
      body: { id: telegramId, hash: 'ok', auth_date: Date.now() } as never,
    });

    expect(result).toEqual({
      ok: false,
      error: 'conflict',
      message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
      details: { code: 'already_linked' },
      status: 400,
    });
  });

  test('links telegram account and updates metadata', async () => {
    const admin = createAdmin();
    let profilesCall = 0;
    const update = jest.fn().mockReturnThis();
    admin.from.mockImplementation(() => {
      if (profilesCall === 0) {
        profilesCall += 1;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      }

      return {
        update,
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      };
    });
    admin.auth.admin.updateUserById.mockResolvedValue({
      error: null,
    });

    const result = await linkTelegramAccount({
      admin,
      user: { id: userId, user_metadata: { locale: 'ru' } },
      body: { id: telegramId, hash: 'ok', auth_date: Date.now() } as never,
    });

    expect(result).toEqual({
      ok: true,
      data: { message: 'Telegram успешно привязан' },
    });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          telegram_id: telegramId,
          telegram_username: 'testuser',
          locale: 'ru',
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith({
      telegram_id: telegramId,
      telegram_username: 'testuser',
      telegram_photo_url: null,
      telegram_verified: true,
    });
  });
});
