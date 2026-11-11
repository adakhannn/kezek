import { redeemMobileSessionGrant } from '@/lib/mobileExchangeService';

export async function runMobileExchangePost(input: { code?: unknown; codeVerifier?: unknown }) {
    return redeemMobileSessionGrant({ code: input.code, codeVerifier: input.codeVerifier });
}

export function runMobileExchangeGet() {
    return { ok: false as const, status: 410, error: 'gone', message: 'Обновите приложение и начните вход заново.' };
}
