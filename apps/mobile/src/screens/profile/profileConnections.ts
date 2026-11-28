/**
 * The rules of the website's profile (apps/web/src/app/cabinet/components/ProfileForm.tsx) that the
 * app's profile shares: which sign-in methods are linked, the e-mail addresses for notifications,
 * and the Telegram bot link polling.
 */

export type SocialProvider = 'google' | 'yandex' | 'telegram' | 'whatsapp';

/** The unlinkable providers plus Sign in with Apple, which is shown read-only (managed in Apple ID). */
export type LoginConnections = Record<SocialProvider, boolean> & { apple: boolean };

type UserLike = {
    app_metadata?: { provider?: string | null; providers?: string[] | null } | null;
    user_metadata?: Record<string, unknown> | null;
    identities?: { provider: string }[] | null;
} | null | undefined;

type ProfileLike = {
    yandex_id?: string | number | null;
    telegram_id?: string | number | null;
    telegram_verified?: boolean | null;
    whatsapp_verified?: boolean | null;
} | null | undefined;

/** Linked as the website decides it: Auth providers, the verified profile ids, the sign-in metadata. */
export function deriveLoginConnections(user: UserLike, profile: ProfileLike): LoginConnections {
    const appMeta = user?.app_metadata ?? {};
    const meta = (user?.user_metadata ?? {}) as { auth_provider?: unknown; telegram_id?: unknown; yandex_id?: unknown };
    const providers = new Set<string>([
        ...(appMeta.providers ?? []),
        ...(appMeta.provider ? [appMeta.provider] : []),
        ...(user?.identities ?? []).map((identity) => identity.provider),
    ]);
    return {
        google: providers.has('google'),
        yandex: !!profile?.yandex_id || !!meta.yandex_id || meta.auth_provider === 'yandex',
        telegram: (!!profile?.telegram_id && !!profile?.telegram_verified) || !!meta.telegram_id,
        whatsapp: !!profile?.whatsapp_verified,
        apple: providers.has('apple'),
    };
}

/** One address of /api/profile/notification-emails. */
export type NotificationEmail = {
    email: string;
    verified: boolean;
    enabled: boolean;
    sources: string[];
};

/** The response rows, keeping only well-formed ones. */
export function parseNotificationEmails(data: unknown): NotificationEmail[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        if (typeof item.email !== 'string' || !item.email) return [];
        return [{
            email: item.email,
            verified: item.verified === true,
            enabled: item.enabled === true,
            sources: Array.isArray(item.sources) ? item.sources.filter((source): source is string => typeof source === 'string') : [],
        }];
    });
}

/** The addresses that receive notifications: enabled and verified. */
export function selectedNotificationEmails(items: NotificationEmail[]): string[] {
    return items.filter((item) => item.enabled && item.verified).map((item) => item.email);
}

/**
 * The website refuses to save e-mail notifications switched on without any chosen address. Only
 * once the list is known: a list that failed to load is not sent and does not block the save.
 */
export function notificationEmailsBlockSave(notifyEmail: boolean, loaded: boolean, items: NotificationEmail[]): boolean {
    return notifyEmail && loaded && selectedNotificationEmails(items).length === 0;
}

export function toggleNotificationEmail(items: NotificationEmail[], email: string, enabled: boolean): NotificationEmail[] {
    return items.map((item) => (item.email === email ? { ...item, enabled } : item));
}

/** "Google · Основной": where an address comes from. */
export function notificationEmailSourceLabel(sources: string[], labels: { google: string; yandex: string; primary: string }): string {
    return sources
        .map((source) => (source === 'google' ? labels.google : source === 'yandex' ? labels.yandex : labels.primary))
        .join(' · ');
}

/** The status poll of the Telegram bot link: every 3 s, backing off to 15 s after failures. */
export function telegramPollDelay(failures: number): number {
    return Math.min(3000 * 2 ** Math.max(0, failures), 15000);
}

export type TelegramLinkStatus = 'pending' | 'approved' | 'expired' | 'cancelled' | 'consumed' | string;

export type TelegramLinkAccount = { id: number; name: string | null; username: string | null };

export type TelegramLinkState = { status: TelegramLinkStatus; account?: TelegramLinkAccount | null };

export type TelegramLinkAttempt = { token: string; expiresAt: string; botDeepLink: string };

export function isTelegramAttemptExpired(attempt: TelegramLinkAttempt, now: number = Date.now()): boolean {
    const expiresAt = Date.parse(attempt.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt <= now;
}

/** Only a Telegram link may be opened from the server's answer. */
export function isTelegramBotLink(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' && (url.hostname === 't.me' || url.hostname === 'telegram.me')) || url.protocol === 'tg:';
    } catch {
        return false;
    }
}
