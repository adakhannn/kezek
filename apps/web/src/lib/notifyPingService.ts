type NotifyPingFailure = {
    ok: false;
    status: 502 | 503;
    error: 'service_unavailable';
    message: string;
    details?: Record<string, unknown>;
};

type NotifyPingSuccess = {
    ok: true;
    payload: {
        ok: boolean;
        status: number;
    };
};

export type NotifyPingResult = NotifyPingFailure | NotifyPingSuccess;

export async function runNotifyPing({
    to,
    env,
    fetchImpl = fetch,
}: {
    to: string;
    env: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
}): Promise<NotifyPingResult> {
    const apiKey = env.RESEND_API_KEY;
    const resolvedFrom = env.EMAIL_FROM?.trim();

    if (!apiKey || !resolvedFrom) {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Отправка диагностических писем не настроена',
        };
    }

    try {
        const response = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: resolvedFrom,
                to,
                subject: 'Kezek test',
                html: '<b>Ping from Kezek</b>',
            }),
        });

        if (!response.ok) {
            return {
                ok: false,
                status: 502,
                error: 'service_unavailable',
                message: 'Провайдер не принял диагностическое письмо',
                details: { providerStatus: response.status },
            };
        }

        return {
            ok: true,
            payload: {
                ok: response.ok,
                status: response.status,
            },
        };
    } catch {
        return {
            ok: false,
            status: 502,
            error: 'service_unavailable',
            message: 'Провайдер отправки недоступен',
        };
    }
}
