import {
  loadWhatsAppBusinessAccountData,
  loadWhatsAppPhoneNumbers,
  type WhatsAppFetchLike,
} from '@/lib/whatsAppAccountLookupService';

describe('whatsAppAccountLookupService', () => {
  function createFetchMock() {
    return jest.fn() as jest.MockedFunction<WhatsAppFetchLike>;
  }

  test('loads business account and phone numbers', async () => {
    const fetchImpl = createFetchMock();
    fetchImpl
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'business-account-id', name: 'Test Business' }],
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'phone-id-1', display_phone_number: '+996555123456' }],
        }),
        text: async () => '',
      });

    const result = await loadWhatsAppBusinessAccountData({
      accessToken: 'token',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        business_accounts: [{ id: 'business-account-id', name: 'Test Business' }],
        selected_account: {
          id: 'business-account-id',
          name: 'Test Business',
        },
        phone_numbers: [{ id: 'phone-id-1', display_phone_number: '+996555123456' }],
        instructions: {
          step1: 'Используйте "id" из selected_account как WhatsApp Business Account ID',
          step2: 'Используйте "id" из phone_numbers как WHATSAPP_PHONE_NUMBER_ID',
          step3: 'Установите эти значения в переменные окружения',
        },
      },
    });
  });

  test('returns validation error on Graph API failure for business accounts', async () => {
    const fetchImpl = createFetchMock();
    fetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => JSON.stringify({
        error: {
          message: 'Invalid access token',
          code: 190,
        },
      }),
    });

    const result = await loadWhatsAppBusinessAccountData({
      accessToken: 'token',
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation');
      expect(result.status).toBe(400);
      expect(result.message).toContain('Invalid access token');
    }
  });

  test('validates missing account id before phone lookup', async () => {
    const fetchImpl = createFetchMock();

    const result = await loadWhatsAppPhoneNumbers({
      accessToken: 'token',
      accountId: null,
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Укажите account_id в query параметрах',
      details: {
        code: 'missing_account_id',
        example: '/api/whatsapp/get-phone-numbers?account_id=1185726307058446',
      },
      status: 400,
    });
  });

  test('loads phone numbers for account', async () => {
    const fetchImpl = createFetchMock();
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 'phone-id-1', display_phone_number: '+996555123456' }],
      }),
      text: async () => '',
    });

    const result = await loadWhatsAppPhoneNumbers({
      accessToken: 'token',
      accountId: '123456789',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        phone_numbers: [{ id: 'phone-id-1', display_phone_number: '+996555123456' }],
        message: 'Найдено 1 номер(ов)',
        instructions: {
          step1: 'Найдите нужный номер телефона в списке выше',
          step2: 'Скопируйте значение поля "id" (это и есть Phone Number ID)',
          step3: 'Установите его в переменную окружения WHATSAPP_PHONE_NUMBER_ID',
        },
      },
    });
  });
});
