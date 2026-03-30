import {
    exchangeMobileTokens,
    getLatestPendingMobileExchange,
    storeMobileTokens,
} from '@/lib/mobileExchangeService';

type Failure = {
    ok: false;
    status: number;
    error: 'validation' | 'not_found';
    message: string;
};

type PostSuccess = {
    ok: true;
    payload: {
        code: string;
    };
};

type CheckSuccess = {
    ok: true;
    payload: {
        hasPending: boolean;
        code?: string;
        createdAt?: number;
    };
};

type ExchangeSuccess = {
    ok: true;
    payload: {
        accessToken: string;
        refreshToken: string;
    };
};

export type MobileExchangePostResult = Failure | PostSuccess;
export type MobileExchangeGetResult = Failure | CheckSuccess | ExchangeSuccess;

export function runMobileExchangePost({
    accessToken,
    refreshToken,
}: {
    accessToken?: string;
    refreshToken?: string;
}): MobileExchangePostResult {
    if (!accessToken || !refreshToken) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать accessToken и refreshToken',
        };
    }

    const result = storeMobileTokens({ accessToken, refreshToken });
    return {
        ok: true,
        payload: { code: result.code },
    };
}

export function runMobileExchangeGet({
    code,
    check,
}: {
    code?: string | null;
    check?: boolean;
}): MobileExchangeGetResult {
    if (check) {
        const pending = getLatestPendingMobileExchange();
        return {
            ok: true,
            payload: pending
                ? {
                      hasPending: true,
                      code: pending.code,
                      createdAt: pending.createdAt,
                  }
                : { hasPending: false },
        };
    }

    if (!code) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать параметр code',
        };
    }

    const result = exchangeMobileTokens(code);
    if (!result.ok) {
        return result;
    }

    return {
        ok: true,
        payload: result.data,
    };
}
