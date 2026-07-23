import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';
import { logWarn } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { syncNotificationEmailsFromUser } from '@/lib/userNotificationEmailService';

export const dynamic = 'force-dynamic';

function signInErrorUrl(origin: string, code: string) {
    const url = new URL('/auth/sign-in', origin);
    url.searchParams.set('error', code);
    return url;
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const nextPath = sanitizeAuthReturnPath(requestUrl.searchParams.get('next'));

    if (!code) {
        return NextResponse.redirect(signInErrorUrl(requestUrl.origin, 'no_code'));
    }

    const callbackUrl = new URL('/auth/callback', requestUrl.origin);
    callbackUrl.searchParams.set('next', nextPath);
    let response = NextResponse.redirect(callbackUrl);

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.redirect(signInErrorUrl(requestUrl.origin, 'oauth_config_error'));
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options?: Parameters<typeof response.cookies.set>[2]) {
                response.cookies.set(name, value, options);
            },
            remove(name: string, options?: Parameters<typeof response.cookies.set>[2]) {
                response.cookies.set(name, '', options);
            },
        },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        response = NextResponse.redirect(
            signInErrorUrl(requestUrl.origin, 'oauth_exchange_failed'),
        );
    } else {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user) {
            try {
                await syncNotificationEmailsFromUser(createSupabaseAdminClient(), user);
            } catch (syncError) {
                logWarn('GoogleAuth', 'Failed to sync notification emails', syncError);
            }
        }
    }

    return response;
}
