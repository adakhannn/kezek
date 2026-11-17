import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getSiteOrigin } from '@/lib/env';
import { logError } from '@/lib/log';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { buildSessionCallbackUrl } from '@/lib/sessionCallbackUrl';
import { issueSessionForVerifiedUser } from '@/lib/verifiedIdentitySession';
import {
    createWebHandoffCode,
    getWebHandoffStore,
    redeemWebHandoffCode,
    type WebHandoffStore,
} from '@/lib/webHandoff';

const bodySchema = z.object({ next: z.string().max(512).optional() }).strict();
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

type Deps = {
    store?: WebHandoffStore | null;
    issueSession?: typeof issueSessionForVerifiedUser;
};

/** POST /api/auth/web-handoff: an authenticated app session asks for a one-time web sign-in URL. */
export async function runCreateWebHandoffHttp(req: Request, deps: Deps = {}): Promise<NextResponse> {
    const auth = await resolveRequestAuthContext(req, 'WebHandoff');
    if (auth instanceof NextResponse) return auth;

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return createErrorResponse('validation', 'Некорректный запрос', undefined, 400);

    const store = deps.store === undefined ? getWebHandoffStore() : deps.store;
    if (!store) return createErrorResponse('service_unavailable', 'Переход в веб-кабинет временно недоступен', undefined, 503);

    const code = await createWebHandoffCode(store, auth.user.id, parsed.data.next);
    const url = new URL('/auth/handoff', getSiteOrigin());
    url.searchParams.set('code', code);
    return NextResponse.json({ ok: true, url: url.toString() }, { headers: NO_STORE });
}

/**
 * GET /auth/handoff?code=…: redeems the code once and hands an independent,
 * freshly issued session to the browser through /auth/callback.
 */
export async function runRedeemWebHandoffHttp(req: Request, deps: Deps = {}): Promise<NextResponse> {
    const { origin, searchParams } = new URL(req.url);
    const fail = (reason: string) =>
        NextResponse.redirect(new URL(`/auth/sign-in?error=${reason}`, origin), { headers: NO_STORE });

    const store = deps.store === undefined ? getWebHandoffStore() : deps.store;
    if (!store) return fail('handoff_unavailable');

    let entry;
    try {
        entry = await redeemWebHandoffCode(store, searchParams.get('code') ?? '');
    } catch (error) {
        logError('WebHandoff', 'Handoff store unavailable', error);
        return fail('handoff_unavailable');
    }
    if (!entry) return fail('handoff_expired');

    try {
        const session = await (deps.issueSession ?? issueSessionForVerifiedUser)(entry.userId);
        return NextResponse.redirect(buildSessionCallbackUrl({
            origin,
            next: entry.next,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
        }), { headers: NO_STORE });
    } catch (error) {
        logError('WebHandoff', 'Could not issue a web session', error);
        return fail('handoff_failed');
    }
}
