import { createHash } from 'crypto';

function parseBooleanFlag(raw: string | undefined, defaultValue: boolean): boolean {
    if (raw == null) {
        return defaultValue;
    }

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
        return false;
    }

    return defaultValue;
}

export function isMobileTelegramDeepLinkAuthEnabled(): boolean {
    const raw =
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH ??
        process.env.NEXT_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH;
    return parseBooleanFlag(raw, true);
}

function parsePercent(raw: string | undefined): number | null {
    if (raw == null || raw.trim() === '') {
        return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function buildRolloutFingerprint(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
    const clientIp = forwardedFor.split(',')[0]?.trim() ?? '';
    const userAgent = request.headers.get('user-agent') ?? '';
    const acceptLanguage = request.headers.get('accept-language') ?? '';
    const explicitKey = request.headers.get('x-mobile-rollout-key')?.trim() ?? '';

    return explicitKey || `${clientIp}|${userAgent}|${acceptLanguage}`;
}

function rolloutBucket(fingerprint: string): number {
    const hash = createHash('sha256').update(fingerprint).digest('hex');
    const firstWord = Number.parseInt(hash.slice(0, 8), 16);
    return firstWord % 100;
}

export function isMobileTelegramDeepLinkAuthEnabledForRequest(
    request: Request,
): boolean {
    if (!isMobileTelegramDeepLinkAuthEnabled()) {
        return false;
    }

    const percent = parsePercent(
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT,
    );
    if (percent == null || percent >= 100) {
        return true;
    }
    if (percent <= 0) {
        return false;
    }

    const fingerprint = buildRolloutFingerprint(request);
    return rolloutBucket(fingerprint) < percent;
}
