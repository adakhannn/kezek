type NotifyPingFailure = {
    ok: false;
    status: 400;
    error: 'validation';
    message: string;
    details?: Record<string, unknown>;
};

type NotifyPingSuccess = {
    ok: true;
    payload: {
        ok: boolean;
        status: number;
        text: string;
    };
};

export type NotifyPingResult = NotifyPingFailure | NotifyPingSuccess;

export async function runNotifyPing({
    to,
    from,
    env,
    fetchImpl = fetch,
}: {
    to: string;
    from?: string;
    env: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
}): Promise<NotifyPingResult> {
    const apiKey = env.RESEND_API_KEY;
    const resolvedFrom = from || env.EMAIL_FROM || 'Kezek <onboarding@resend.dev>';

    if (!apiKey) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'RESEND_API_KEY не установлен',
            details: { code: 'no RESEND_API_KEY' },
        };
    }

    const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
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

    const text = await response.text().catch(() => '');

    return {
        ok: true,
        payload: {
            ok: response.ok,
            status: response.status,
            text,
        },
    };
}
