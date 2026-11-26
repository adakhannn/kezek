import { apiRequest } from '../../lib/api';

/**
 * The web cabinet's API acts on the user's current business (user_current_business, the same row
 * the website's /select-business writes). Before a management screen reads or writes, the business
 * chosen in the app is made current with POST /api/me/current-business; one request per business
 * per app run, shared by every caller.
 */
const pending = new Map<string, Promise<void>>();

export function ensureCurrentBusiness(bizId: string): Promise<void> {
    let request = pending.get(bizId);
    if (!request) {
        // Another business chosen meanwhile: the previous choice is stale.
        pending.clear();
        request = apiRequest<{ ok?: boolean }>('/me/current-business', {
            method: 'POST',
            body: JSON.stringify({ bizId }),
        }).then((response) => {
            if (!response?.ok) throw new Error('Current business was not selected');
        });
        request.catch(() => pending.delete(bizId));
        pending.set(bizId, request);
    }
    return request;
}

/** Forget the cached choice (sign-out, or the website may have switched the business). */
export function resetCurrentBusiness(): void {
    pending.clear();
}
