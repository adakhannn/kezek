import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logError } from '@/lib/log';
import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import {
    registerPushToken,
    registerPushTokenSchema,
    unregisterPushToken,
    unregisterPushTokenSchema,
} from '@/lib/pushTokens';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

async function authenticate(req: Request) {
    return resolveMobileBookingAuth({
        authorizationHeader: req.headers.get('Authorization'),
        supabaseUrl: getSupabaseUrl(),
        anonKey: getSupabaseAnonKey(),
        createServerClient: createSupabaseServerClient,
    });
}

/** The body parsed by `schema`; the response names the invalid fields, never their values (a token). */
async function readBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
    let body: unknown;
    try { body = await req.json(); }
    catch { return { ok: false, response: createErrorResponse('validation', 'Invalid JSON in request body', undefined, 400) }; }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return { ok: false, response: createErrorResponse('validation', 'Invalid push token request',
            { fields: parsed.error.issues.map(issue => issue.path.join('.')) }, 400) };
    }
    return { ok: true, data: parsed.data };
}

/** POST /api/mobile/push-tokens: the signed-in user's install receives booking push notifications. */
export async function runRegisterPushTokenHttp(req: Request): Promise<NextResponse> {
    const auth = await authenticate(req);
    if (!auth.ok) return createErrorResponse(auth.error, auth.message, undefined, auth.status);
    const body = await readBody(req, registerPushTokenSchema);
    if (!body.ok) return body.response;
    try {
        // push_tokens is closed to client sessions; the user was verified above.
        await registerPushToken(getServiceClient(), auth.user.id, body.data);
    } catch (error) {
        logError('MobilePushTokens', 'Push token registration failed', { error });
        return createErrorResponse('internal', 'Push token could not be saved', undefined, 500);
    }
    return createSuccessResponse({ registered: true });
}

/** DELETE /api/mobile/push-tokens: sign-out or the Profile switch turns push off for this install. */
export async function runUnregisterPushTokenHttp(req: Request): Promise<NextResponse> {
    const auth = await authenticate(req);
    if (!auth.ok) return createErrorResponse(auth.error, auth.message, undefined, auth.status);
    const body = await readBody(req, unregisterPushTokenSchema);
    if (!body.ok) return body.response;
    try {
        await unregisterPushToken(getServiceClient(), auth.user.id, body.data.token);
    } catch (error) {
        logError('MobilePushTokens', 'Push token removal failed', { error });
        return createErrorResponse('internal', 'Push token could not be removed', undefined, 500);
    }
    return createSuccessResponse({ registered: false });
}
