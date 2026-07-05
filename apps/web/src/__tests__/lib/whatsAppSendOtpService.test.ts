import {
  sendProfileWhatsAppOtp,
  type WhatsAppSendOtpSupabaseLike,
} from '@/lib/whatsAppSendOtpService';

describe('whatsAppSendOtpService', () => {
  function createSupabase() {
    return {
      auth: {
        getUser: jest.fn(),
        updateUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<WhatsAppSendOtpSupabaseLike>;
  }

  test('rejects anonymous user', async () => {
    const supabase = createSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const result = await sendProfileWhatsAppOtp({
      supabase,
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage: jest.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    });
  });

  test('rejects already verified whatsapp number', async () => {
    const supabase = createSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          whatsapp_phone: '+996555123456',
          whatsapp_verified: true,
        },
        error: null,
      }),
    });

    const result = await sendProfileWhatsAppOtp({
      supabase,
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage: jest.fn(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'WhatsApp номер уже подтвержден',
      details: { code: 'already_verified' },
      status: 400,
    });
  });

  test('sends otp successfully', async () => {
    const supabase = createSupabase();
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          whatsapp_phone: '+996555123456',
          whatsapp_verified: false,
        },
        error: null,
      }),
    });
    supabase.auth.updateUser.mockResolvedValue({
      error: null,
    });

    const result = await sendProfileWhatsAppOtp({
      supabase,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage,
      now: new Date('2026-03-27T10:00:00.000Z'),
      authTemplateName: 'kezek_otp',
      authTemplateLanguage: 'ru',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: 'Код отправлен на WhatsApp',
      },
    });
    expect(sendMessage).toHaveBeenCalledWith({
      to: '+996555123456',
      text: expect.stringContaining('Ваш код подтверждения WhatsApp'),
      template: {
        name: 'kezek_otp',
        language: 'ru',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: expect.stringMatching(/^\d{6}$/) }],
          },
        ],
      },
    });
  });
});
