import {
  sendWhatsAppAuthOtp,
  type WhatsAppAuthSendOtpAdminLike,
} from '@/lib/whatsAppAuthSendOtpService';

describe('whatsAppAuthSendOtpService', () => {
  function createAdmin() {
    return {
      auth: {
        admin: {
          listUsers: jest.fn(),
          updateUserById: jest.fn(),
        },
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<WhatsAppAuthSendOtpAdminLike>;
  }

  test('validates missing phone', async () => {
    const admin = createAdmin();

    const result = await sendWhatsAppAuthOtp({
      admin,
      phone: undefined,
      normalizePhone: jest.fn(),
      sendMessage: jest.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Номер телефона не указан',
      details: { code: 'no_phone' },
      status: 400,
    });
  });

  test('updates existing user metadata before sending', async () => {
    const admin = createAdmin();
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    admin.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: 'user-id', phone: '+996555123456', user_metadata: {} }],
      },
    });
    admin.auth.admin.updateUserById.mockResolvedValue({
      error: null,
    });
    admin.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        error: null,
      }),
    });

    const result = await sendWhatsAppAuthOtp({
      admin,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage,
      now: new Date('2026-03-27T10:00:00.000Z'),
      random: () => 0.123456,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: 'Код отправлен на WhatsApp',
      },
    });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          whatsapp_auth_otp: expect.any(String),
        }),
      }),
    );
    expect(sendMessage).toHaveBeenCalled();
  });

  test('returns internal error when send fails', async () => {
    const admin = createAdmin();
    admin.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [],
      },
    });

    const result = await sendWhatsAppAuthOtp({
      admin,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage: jest.fn().mockRejectedValue(new Error('WhatsApp service unavailable')),
    });

    expect(result).toEqual({
      ok: false,
      error: 'internal',
      message: 'Не удалось отправить код: WhatsApp service unavailable',
      details: { code: 'send_failed' },
      status: 500,
    });
  });
});
