import { getTelegramMobileAuthStatus } from '@/lib/telegramMobileAuthAttemptService';

type Failure = {
    ok: false;
    status: 400;
    error: 'validation';
    message: string;
};

type Success = {
    ok: true;
    payload: {
        status: 'pending' | 'approved' | 'expired' | 'failed';
        expiresAt: number | null;
        exchangeCode?: string;
    };
};

export type TelegramMobileStatusRouteResult = Failure | Success;

export async function runTelegramMobileStatusRoute({
    nonce,
}: {
    nonce?: string | null;
}): Promise<TelegramMobileStatusRouteResult> {
    if (!nonce || !nonce.trim()) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать параметр nonce',
        };
    }

    const result = await getTelegramMobileAuthStatus(nonce.trim());

    return {
        ok: true,
        payload: {
            status: result.status === 'consumed' ? 'pending' : result.status,
            expiresAt: result.expiresAt,
            exchangeCode: result.exchangeCode,
        },
    };
}
