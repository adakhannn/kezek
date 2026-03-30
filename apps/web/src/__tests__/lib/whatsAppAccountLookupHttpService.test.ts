import {
  runWhatsAppBusinessAccountLookupHttp,
  runWhatsAppPhoneNumbersLookupHttp,
} from '@/lib/whatsAppAccountLookupHttpService';

jest.mock('@/lib/env', () => ({
  getWhatsAppAccessToken: jest.fn(),
}));

jest.mock('@/lib/whatsAppAccountLookupService', () => ({
  loadWhatsAppBusinessAccountData: jest.fn(),
  loadWhatsAppPhoneNumbers: jest.fn(),
}));

import { getWhatsAppAccessToken } from '@/lib/env';
import {
  loadWhatsAppBusinessAccountData,
  loadWhatsAppPhoneNumbers,
} from '@/lib/whatsAppAccountLookupService';

describe('whatsAppAccountLookupHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWhatsAppAccessToken as jest.Mock).mockReturnValue('token');
  });

  test('loads business account lookup through env token', async () => {
    (loadWhatsAppBusinessAccountData as jest.Mock).mockResolvedValue({
      ok: true,
      data: { business_accounts: [] },
    });

    const response = await runWhatsAppBusinessAccountLookupHttp();
    const body = await response.json();

    expect(loadWhatsAppBusinessAccountData).toHaveBeenCalledWith({
      accessToken: 'token',
      fetchImpl: fetch,
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ business_accounts: [] });
  });

  test('loads phone numbers using account id from request', async () => {
    (loadWhatsAppPhoneNumbers as jest.Mock).mockResolvedValue({
      ok: true,
      data: { phone_numbers: [] },
    });

    const response = await runWhatsAppPhoneNumbersLookupHttp(
      new Request('http://localhost/api/whatsapp/get-phone-numbers?account_id=123'),
    );
    const body = await response.json();

    expect(loadWhatsAppPhoneNumbers).toHaveBeenCalledWith({
      accessToken: 'token',
      accountId: '123',
      fetchImpl: fetch,
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ phone_numbers: [] });
  });
});
