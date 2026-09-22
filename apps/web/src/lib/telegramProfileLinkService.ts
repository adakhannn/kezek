import { createHash, randomBytes } from 'crypto';

import { getServiceClient } from '@/lib/supabaseService';

export const PROFILE_LINK_TOKEN = /^[A-Za-z0-9_-]{32}$/;
export function hashProfileLinkToken(token: string) {
    if (!PROFILE_LINK_TOKEN.test(token)) throw new Error('Invalid profile link token');
    return createHash('sha256').update(token).digest('hex');
}

export async function createProfileLink(ownerId: string, botUsername: string) {
    const admin = getServiceClient();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error } = await admin.from('telegram_profile_link_attempts').insert({
        token_hash: hashProfileLinkToken(token), owner_id: ownerId, expires_at: expiresAt,
    });
    if (error) throw new Error('Telegram profile link storage unavailable');
    return { token, expiresAt, botDeepLink: `https://t.me/${botUsername}?start=kl1_${token}` };
}

export async function readProfileLink(ownerId: string, token: string) {
    const { data, error } = await getServiceClient().from('telegram_profile_link_attempts')
        .select('status,expires_at,telegram_id,telegram_username,telegram_name')
        .eq('token_hash', hashProfileLinkToken(token)).eq('owner_id', ownerId).maybeSingle();
    if (error) throw new Error('Telegram profile link storage unavailable');
    if (!data) return null;
    const status = data.status !== 'consumed' && Date.parse(data.expires_at) <= Date.now() ? 'expired' : data.status;
    return {
        status, expiresAt: data.expires_at,
        // Do not reveal an account until its owner has explicitly approved in Telegram.
        account: status === 'approved' ? {
            id: data.telegram_id as number, username: data.telegram_username as string | null,
            name: data.telegram_name as string | null,
        } : null,
    };
}

export type ProfileLinkTransition = { status?: string; error?: string };
export async function transitionProfileLink(params: {
    token: string; action: 'claim' | 'approve' | 'cancel_bot' | 'cancel_owner' | 'finish';
    ownerId?: string; telegramId?: number; username?: string; name?: string;
}): Promise<ProfileLinkTransition> {
    const { data, error } = await getServiceClient().rpc('transition_telegram_profile_link', {
        p_hash: hashProfileLinkToken(params.token), p_action: params.action,
        p_owner: params.ownerId ?? null, p_telegram: params.telegramId ?? null,
        p_username: params.username ?? null, p_name: params.name ?? null,
    });
    if (error) throw new Error('Telegram profile link transition failed');
    return data as ProfileLinkTransition;
}

export const profileLinkErrorMessage = (code: string) => ({
    expired: 'Ссылка истекла. Создайте новую.',
    already_linked: 'Этот Telegram уже подключён к другому профилю Kezek. Выберите другой Telegram-аккаунт.',
    already_connected: 'К профилю уже подключён другой Telegram. Сначала отвяжите его.',
    different_account: 'Эта ссылка уже открыта другим Telegram-аккаунтом. Создайте новую ссылку.',
    not_found: 'Запрос не найден. Создайте новую ссылку.',
    not_approved: 'Сначала подтвердите запрос в Telegram.',
    closed: 'Запрос уже закрыт. Создайте новую ссылку.',
}[code] || 'Не удалось подключить Telegram. Начните заново.');
