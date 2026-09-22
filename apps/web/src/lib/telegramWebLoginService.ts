import { createHash, randomBytes } from 'crypto';

import { getServiceClient } from '@/lib/supabaseService';

export const WEB_LOGIN_TOKEN = /^[A-Za-z0-9_-]{32}$/;
export const webLoginSecret = () => randomBytes(24).toString('base64url');
export function webLoginHash(value: string) {
    if (!WEB_LOGIN_TOKEN.test(value)) throw new Error('Invalid login request');
    return createHash('sha256').update(value).digest('hex');
}
export const webLoginCode = (token: string) => webLoginHash(token).slice(0, 6).toUpperCase();
export async function createWebLogin(browserSecret: string, bot: string) {
    const token = webLoginSecret();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const { error } = await getServiceClient().from('telegram_web_login_attempts').insert({
        token_hash: webLoginHash(token), browser_hash: webLoginHash(browserSecret), expires_at: expiresAt,
    });
    if (error) throw new Error('Login storage unavailable');
    return { token, expiresAt, code: webLoginCode(token), botDeepLink: `https://t.me/${bot}?start=kw1_${token}` };
}
export async function readWebLogin(token: string, browser: string) {
    const { data, error } = await getServiceClient().from('telegram_web_login_attempts')
        .select('status,expires_at,telegram_id,telegram_name').eq('token_hash', webLoginHash(token))
        .eq('browser_hash', webLoginHash(browser)).maybeSingle();
    if (error) throw new Error('Login storage unavailable');
    if (!data) return null;
    const status = Date.parse(data.expires_at) <= Date.now() ? 'expired' : data.status;
    return { status, account: status === 'approved' ? { id: data.telegram_id, name: data.telegram_name } : null };
}
export async function transitionWebLogin(token: string, action: string, browser?: string, telegramId?: number, name?: string): Promise<{ error?: string; status?: string; user_id?: string }> {
    const { data, error } = await getServiceClient().rpc('transition_telegram_web_login', {
        p_hash: webLoginHash(token), p_action: action, p_browser: browser ? webLoginHash(browser) : null,
        p_telegram: telegramId ?? null, p_name: name ?? null,
    });
    if (error) throw new Error('Login transition unavailable');
    return data;
}
