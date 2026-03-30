export type WhatsAppFetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

type BusinessAccountRecord = {
  id: string;
  name?: string;
};

type PhoneNumberRecord = {
  id: string;
  verified_name?: string;
  display_phone_number?: string;
};

export type WhatsAppAccountLookupResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: 'validation';
      message: string;
      status: number;
      details: Record<string, unknown>;
    };

function buildGraphApiError(params: {
  status: number;
  rawText: string;
  url?: string;
  addPermissionTroubleshooting?: boolean;
}) {
  let message = `Graph API error: HTTP ${params.status}`;
  let details: Record<string, unknown> = {
    code: 'api_error',
  };

  try {
    const parsed = JSON.parse(params.rawText) as {
      error?: { message?: string; code?: number; type?: string };
    };
    message += ` — ${parsed.error?.message || params.rawText.slice(0, 500)}`;
    details = {
      ...details,
      details: parsed.error ?? null,
    };

    if (params.addPermissionTroubleshooting && (parsed.error?.code === 100 || parsed.error?.type === 'OAuthException')) {
      details.troubleshooting = [
        '1. Зайдите в Meta Developers → Настройки компании → Пользователи системы',
        '2. Выберите пользователя системы, который используется для генерации токена',
        '3. Убедитесь, что у него есть разрешения whatsapp_business_messaging, whatsapp_business_management и business_management',
        '4. Сгенерируйте новый long-lived token с этими разрешениями',
        '5. Обновите WHATSAPP_ACCESS_TOKEN в переменных окружения',
      ];
    }
  } catch {
    message += ` — ${params.rawText.slice(0, 500)}`;
  }

  if (params.url) {
    details.url = params.url;
  }

  return {
    ok: false as const,
    error: 'validation' as const,
    message,
    details,
    status: params.status,
  };
}

export async function loadWhatsAppBusinessAccountData(params: {
  accessToken: string;
  fetchImpl: WhatsAppFetchLike;
}): Promise<
  WhatsAppAccountLookupResult<
    | {
        business_accounts: unknown;
        selected_account: { id: unknown; name: unknown };
        phone_numbers: unknown[];
        instructions: { step1: string; step2: string; step3: string };
      }
    | { business_accounts: unknown; message: string }
  >
> {
  const businessAccountsUrl = 'https://graph.facebook.com/v21.0/me/businesses';
  const businessAccountsResp = await params.fetchImpl(businessAccountsUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!businessAccountsResp.ok) {
    return buildGraphApiError({
      status: businessAccountsResp.status,
      rawText: await businessAccountsResp.text(),
      addPermissionTroubleshooting: true,
    });
  }

  const businessAccountsPayload = (await businessAccountsResp.json()) as {
    data?: BusinessAccountRecord[];
  };

  if (businessAccountsPayload.data && businessAccountsPayload.data.length > 0) {
    const selectedAccount = businessAccountsPayload.data[0];
    const phoneNumbersUrl = `https://graph.facebook.com/v21.0/${selectedAccount.id}/phone_numbers`;
    const phoneNumbersResp = await params.fetchImpl(phoneNumbersUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    });

    let phoneNumbers: PhoneNumberRecord[] = [];
    if (phoneNumbersResp.ok) {
      const phoneNumbersPayload = (await phoneNumbersResp.json()) as { data?: PhoneNumberRecord[] };
      phoneNumbers = phoneNumbersPayload.data || [];
    }

    return {
      ok: true,
      data: {
        business_accounts: businessAccountsPayload.data,
        selected_account: {
          id: selectedAccount.id,
          name: selectedAccount.name || 'N/A',
        },
        phone_numbers: phoneNumbers,
        instructions: {
          step1: 'Используйте "id" из selected_account как WhatsApp Business Account ID',
          step2: 'Используйте "id" из phone_numbers как WHATSAPP_PHONE_NUMBER_ID',
          step3: 'Установите эти значения в переменные окружения',
        },
      },
    };
  }

  return {
    ok: true,
    data: {
      business_accounts: businessAccountsPayload.data || [],
      message: 'Бизнес-аккаунты получены, но номера не найдены',
    },
  };
}

export async function loadWhatsAppPhoneNumbers(params: {
  accessToken: string;
  accountId: string | null;
  fetchImpl: WhatsAppFetchLike;
}): Promise<
  WhatsAppAccountLookupResult<
    | {
        phone_numbers: unknown;
        message: string;
        instructions: { step1: string; step2: string; step3: string };
      }
    | { data: unknown; message: string }
  >
> {
  if (!params.accountId) {
    return {
      ok: false,
      error: 'validation',
      message: 'Укажите account_id в query параметрах',
      details: {
        code: 'missing_account_id',
        example: '/api/whatsapp/get-phone-numbers?account_id=1185726307058446',
      },
      status: 400,
    };
  }

  const url = `https://graph.facebook.com/v21.0/${params.accountId}/phone_numbers`;
  const resp = await params.fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!resp.ok) {
    return buildGraphApiError({
      status: resp.status,
      rawText: await resp.text(),
      url,
      addPermissionTroubleshooting: true,
    });
  }

  const payload = (await resp.json()) as { data?: unknown };
  if (payload.data && Array.isArray(payload.data)) {
    return {
      ok: true,
      data: {
        phone_numbers: payload.data,
        message: `Найдено ${payload.data.length} номер(ов)`,
        instructions: {
          step1: 'Найдите нужный номер телефона в списке выше',
          step2: 'Скопируйте значение поля "id" (это и есть Phone Number ID)',
          step3: 'Установите его в переменную окружения WHATSAPP_PHONE_NUMBER_ID',
        },
      },
    };
  }

  return {
    ok: true,
    data: {
      data: payload,
      message: 'Данные получены успешно',
    },
  };
}
