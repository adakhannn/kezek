type MappedProviderError = {
    error: 'template_mismatch' | 'rate_limit' | 'recipient_unavailable' | 'provider_unavailable' | 'provider_error';
    status: 400 | 429 | 503 | 502;
    message: string;
    details?: Record<string, unknown>;
};

export function mapWhatsAppProviderError(error: unknown): MappedProviderError {
    const raw = error instanceof Error ? error.message : String(error);
    const normalized = raw.toLowerCase();

    if (
        normalized.includes('132000') ||
        normalized.includes('localizable_params') ||
        normalized.includes('template') && normalized.includes('parameter')
    ) {
        return {
            error: 'template_mismatch',
            status: 400,
            message: 'Неверная конфигурация WhatsApp шаблона или параметров.',
            details: { providerMessage: raw },
        };
    }

    if (
        normalized.includes('rate limit') ||
        normalized.includes('too many requests') ||
        normalized.includes('code\":4') ||
        normalized.includes('code\":80007')
    ) {
        return {
            error: 'rate_limit',
            status: 429,
            message: 'Лимит WhatsApp API превышен. Повторите позже.',
            details: { providerMessage: raw },
        };
    }

    if (
        normalized.includes('recipient') ||
        normalized.includes('not a whatsapp') ||
        normalized.includes('131026') ||
        normalized.includes('invalid wa')
    ) {
        return {
            error: 'recipient_unavailable',
            status: 400,
            message: 'Получатель недоступен в WhatsApp или номер не поддерживается.',
            details: { providerMessage: raw },
        };
    }

    if (
        normalized.includes('temporarily unavailable') ||
        normalized.includes('service unavailable') ||
        normalized.includes('oauth') ||
        normalized.includes('http 5')
    ) {
        return {
            error: 'provider_unavailable',
            status: 503,
            message: 'Сервис WhatsApp временно недоступен.',
            details: { providerMessage: raw },
        };
    }

    return {
        error: 'provider_error',
        status: 502,
        message: 'Ошибка WhatsApp провайдера.',
        details: { providerMessage: raw },
    };
}

