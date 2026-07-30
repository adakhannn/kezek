import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';

export function buildGoogleOAuthRedirectUrl(origin: string, nextPath: string): string {
    const callbackUrl = new URL('/auth/callback/google', origin);
    callbackUrl.searchParams.set('next', sanitizeAuthReturnPath(nextPath));
    return callbackUrl.toString();
}
