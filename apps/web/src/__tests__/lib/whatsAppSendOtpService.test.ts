import {
  sendProfileWhatsAppOtp,
  type WhatsAppSendOtpSupabaseLike,
} from '@/lib/whatsAppSendOtpService';

describe('whatsAppSendOtpService', () => {
  function createSupabase() {
    return {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<WhatsAppSendOtpSupabaseLike>;
  }

  function createStore() {
    return { save: jest.fn().mockResolvedValue(undefined), load: jest.fn(), clear: jest.fn() };
  }

  const hashOtp = (code: string) => `h:${code}`;

  function profileReturning(data: unknown) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
    };
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
      otpStore: createStore(),
      hashOtp,
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
    supabase.from.mockReturnValueOnce(
      profileReturning({ whatsapp_phone: '+996555123456', whatsapp_verified: true }),
    );

    const result = await sendProfileWhatsAppOtp({
      supabase,
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage: jest.fn(),
      otpStore: createStore(),
      hashOtp,
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'WhatsApp номер уже подтвержден',
      details: { code: 'already_verified' },
      status: 400,
    });
  });

  test('sends otp and stores only its hash server-side', async () => {
    const supabase = createSupabase();
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    supabase.from.mockReturnValueOnce(
      profileReturning({ whatsapp_phone: '+996555123456', whatsapp_verified: false }),
    );
    const otpStore = createStore();

    const result = await sendProfileWhatsAppOtp({
      supabase,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage,
      now: new Date('2026-03-27T10:00:00.000Z'),
      authTemplateName: 'kezek_otp',
      authTemplateLanguage: 'ru',
      otpStore,
      hashOtp,
      generateCode: () => '654321',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: 'Код отправлен на WhatsApp',
      },
    });
    expect(otpStore.save).toHaveBeenCalledWith('user-id', {
      codeHash: 'h:654321',
      phone: '+996555123456',
      expiresAt: '2026-03-27T10:10:00.000Z',
      attempts: 0,
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
            parameters: [{ type: 'text', text: '654321' }],
          },
        ],
      },
    });
  });

  test('generates a six-digit code by default', async () => {
    const supabase = createSupabase();
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });
    supabase.from.mockReturnValueOnce(profileReturning(null));

    await sendProfileWhatsAppOtp({
      supabase,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage,
      otpStore: createStore(),
      hashOtp,
    });

    expect(sendMessage.mock.calls[0][0].text).toMatch(/: \d{6}\n/);
  });

  test('does not send a code when it cannot be stored', async () => {
    const supabase = createSupabase();
    const sendMessage = jest.fn();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });
    supabase.from.mockReturnValueOnce(profileReturning(null));
    const otpStore = createStore();
    otpStore.save.mockRejectedValueOnce(new Error('down'));

    const result = await sendProfileWhatsAppOtp({
      supabase,
      phone: '+996555123456',
      normalizePhone: jest.fn().mockReturnValue('+996555123456'),
      sendMessage,
      otpStore,
      hashOtp,
    });

    expect(result).toMatchObject({ ok: false, details: { code: 'otp_save_failed' } });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
