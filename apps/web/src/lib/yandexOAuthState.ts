import { createHash, randomBytes } from 'node:crypto';

import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';
import { getServiceClient } from '@/lib/supabaseService';

export type YandexOAuthFlow = 'sign_in' | 'link';

function hashState(state: string) {
    return createHash('sha256').update(state).digest('hex');
}

/** The database owns expiry and atomic consumption; cookies bind the attempt to the browser. */
export async function createYandexOAuthState(flow: YandexOAuthFlow, userId: string | null, returnPath = '/') {
    const state = randomBytes(32).toString('hex');
    const { error } = await getServiceClient().rpc('create_yandex_oauth_state', {
        p_state_hash: hashState(state),
        p_flow: flow,
        p_user_id: userId,
        p_return_path: sanitizeAuthReturnPath(returnPath),
    });
    if (error) throw new Error('Yandex state storage unavailable');
    return state;
}

export async function consumeYandexOAuthState(state: string, flow: YandexOAuthFlow, userId: string | null) {
    if (!/^[a-f0-9]{64}$/.test(state)) return null;
    const { data, error } = await getServiceClient().rpc('consume_yandex_oauth_state', {
        p_state_hash: hashState(state),
        p_flow: flow,
        p_user_id: userId,
    });
    if (error) throw new Error('Yandex state storage unavailable');
    if (!data || typeof data !== 'object' || data.flow !== flow || data.user_id !== userId) return null;
    return { returnPath: sanitizeAuthReturnPath(data.return_path) };
}
