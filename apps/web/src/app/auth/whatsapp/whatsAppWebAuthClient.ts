export type StartResponseData = {
  attemptId: string;
  maskedDestination?: string;
  expiresAt: string;
};

export type VerifyResponseData = {
  status: 'approved' | 'pending' | 'failed' | 'expired';
  attemptId: string;
  exchangeCode?: string;
  expiresAt?: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  details?: { providerMessage?: string };
  data?: unknown;
};

/** The page passes useLanguage().t; without it the Russian fallback text is used. */
type Translate = (key: string, fallback: string) => string;
const russianFallback: Translate = (_key, fallback) => fallback;

export function extractApiMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const value = payload as ApiPayload;
  return value.message || value.details?.providerMessage || value.error || fallback;
}

export function mapStartError(status: number, payload: unknown, t: Translate = russianFallback): string {
  if (status === 503) return t('auth.whatsapp.error.startUnavailable', 'Вход через WhatsApp временно недоступен для вашего профиля. Попробуйте позже.');
  if (status === 429) return t('auth.whatsapp.error.startRateLimited', 'Слишком много попыток. Подождите немного и попробуйте снова.');
  return extractApiMessage(payload, t('auth.whatsapp.error.startFailed', 'Не удалось отправить код в WhatsApp.'));
}

export function mapVerifyError(status: number, payload: unknown, t: Translate = russianFallback): string {
  if (status === 503) return t('auth.whatsapp.error.verifyUnavailable', 'Вход через WhatsApp временно недоступен. Попробуйте позже.');
  if (status === 429) return t('auth.whatsapp.error.verifyRateLimited', 'Слишком много попыток проверки. Подождите немного и повторите.');
  return extractApiMessage(payload, t('auth.whatsapp.error.verifyFailed', 'Не удалось проверить код.'));
}

export async function startWhatsAppWebAuth(
  fetcher: typeof fetch,
  phone: string,
  codeChallenge: string,
  t: Translate = russianFallback,
): Promise<StartResponseData> {
  const response = await fetcher('/api/auth/whatsapp/mobile/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone.trim(), codeChallenge }),
  });
  const data = (await response.json()) as ApiPayload;

  if (!response.ok || !data?.ok) {
    throw new Error(mapStartError(response.status, data, t));
  }

  return data.data as StartResponseData;
}

export async function verifyWhatsAppWebOtp(
  fetcher: typeof fetch,
  params: { attemptId: string; phone: string; code: string },
  t: Translate = russianFallback,
): Promise<VerifyResponseData> {
  const response = await fetcher('/api/auth/whatsapp/mobile/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attemptId: params.attemptId,
      phone: params.phone.trim(),
      code: params.code.trim(),
    }),
  });
  const data = (await response.json()) as ApiPayload;

  if (!response.ok || !data?.ok) {
    throw new Error(mapVerifyError(response.status, data, t));
  }

  return data.data as VerifyResponseData;
}

export async function exchangeWhatsAppWebSession(
  fetcher: typeof fetch,
  exchangeCode: string,
  codeVerifier: string,
  t: Translate = russianFallback,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetcher(
    '/api/auth/mobile-exchange',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: exchangeCode, codeVerifier }),
    },
  );
  const data = (await response.json()) as ApiPayload & {
    data?: { accessToken?: string; refreshToken?: string };
  };

  if (
    !response.ok ||
    !data?.ok ||
    !data?.data?.accessToken ||
    !data?.data?.refreshToken
  ) {
    throw new Error(t('auth.whatsapp.error.exchangeFailed', 'Не удалось завершить вход. Повторите попытку.'));
  }

  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
  };
}
