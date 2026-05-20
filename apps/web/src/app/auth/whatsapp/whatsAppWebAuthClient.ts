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

export function extractApiMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const value = payload as ApiPayload;
  return value.message || value.details?.providerMessage || value.error || fallback;
}

export function mapStartError(status: number, payload: unknown): string {
  if (status === 503) return 'Вход через WhatsApp временно недоступен для вашего профиля. Попробуйте позже.';
  if (status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  return extractApiMessage(payload, 'Не удалось отправить код в WhatsApp.');
}

export function mapVerifyError(status: number, payload: unknown): string {
  if (status === 503) return 'Вход через WhatsApp временно недоступен. Попробуйте позже.';
  if (status === 429) return 'Слишком много попыток проверки. Подождите немного и повторите.';
  return extractApiMessage(payload, 'Не удалось проверить код.');
}

export async function startWhatsAppWebAuth(
  fetcher: typeof fetch,
  phone: string,
): Promise<StartResponseData> {
  const response = await fetcher('/api/auth/whatsapp/mobile/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone.trim() }),
  });
  const data = (await response.json()) as ApiPayload;

  if (!response.ok || !data?.ok) {
    throw new Error(mapStartError(response.status, data));
  }

  return data.data as StartResponseData;
}

export async function verifyWhatsAppWebOtp(
  fetcher: typeof fetch,
  params: { attemptId: string; phone: string; code: string },
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
    throw new Error(mapVerifyError(response.status, data));
  }

  return data.data as VerifyResponseData;
}

export async function exchangeWhatsAppWebSession(
  fetcher: typeof fetch,
  exchangeCode: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetcher(
    `/api/auth/mobile-exchange?code=${encodeURIComponent(exchangeCode)}`,
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
    throw new Error('Не удалось завершить вход. Повторите попытку.');
  }

  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
  };
}
