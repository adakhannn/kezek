import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export type PreferredLocale = 'ru' | 'ky' | 'en';

export function isPreferredLocale(value: unknown): value is PreferredLocale {
    return value === 'ru' || value === 'ky' || value === 'en';
}

/**
 * POST /api/profile/locale (FE-10): saves the site language of the signed-in user as
 * profiles.preferred_locale, the language of their booking notifications. Only the cookie session
 * names the profile: the body carries the language and nothing else is read from it. The service
 * client writes that one column of that one row; a user without a profile row changes nothing.
 */
export async function runProfileLocaleHttp(req: Request): Promise<NextResponse> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return createErrorResponse('auth', undefined, undefined, 401);
    }

    const body: unknown = await req.json().catch(() => null);
    const locale = body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { locale?: unknown }).locale
        : undefined;
    if (!isPreferredLocale(locale)) {
        return createErrorResponse('validation', 'Неизвестный язык: допустимы ru, ky и en', undefined, 400);
    }

    const { error } = await createSupabaseAdminClient()
        .from('profiles')
        .update({ preferred_locale: locale })
        .eq('id', user.id);
    if (error) {
        logError('ProfileLocale', 'Failed to save the preferred locale', error);
        return createErrorResponse('internal', undefined, undefined, 500);
    }

    return createSuccessResponse({ locale });
}
