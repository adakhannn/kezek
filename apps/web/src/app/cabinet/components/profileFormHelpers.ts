export type ProfileFormProfile = {
    full_name: string | null;
    phone: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
    whatsapp_verified: boolean;
    notify_telegram: boolean;
    telegram_connected: boolean;
};

type ProfileRow = {
    full_name?: string | null;
    phone?: string | null;
    notify_email?: boolean | null;
    notify_whatsapp?: boolean | null;
    whatsapp_verified?: boolean | null;
    notify_telegram?: boolean | null;
    telegram_id?: number | string | null;
    telegram_verified?: boolean | null;
};

type UserMeta = {
    telegram_id?: number | string | null;
};

export function createInitialProfile(): ProfileFormProfile {
    return {
        full_name: null,
        phone: null,
        notify_email: true,
        notify_whatsapp: true,
        whatsapp_verified: false,
        notify_telegram: true,
        telegram_connected: false,
    };
}

export function mapProfileFromSources(
    profile: ProfileRow | null | undefined,
    userMeta: UserMeta | null | undefined,
): ProfileFormProfile {
    const telegramFromProfile = !!profile?.telegram_id && !!profile?.telegram_verified;
    const telegramFromMeta = !!userMeta?.telegram_id;

    return {
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        notify_email: profile?.notify_email ?? true,
        notify_whatsapp: profile?.notify_whatsapp ?? true,
        whatsapp_verified: profile?.whatsapp_verified ?? false,
        notify_telegram: profile?.notify_telegram ?? true,
        telegram_connected: telegramFromProfile || telegramFromMeta,
    };
}

export function createProfileUpdatePayload(profile: ProfileFormProfile) {
    return {
        full_name: profile.full_name || null,
        phone: profile.phone || null,
        notify_email: profile.notify_email,
        notify_whatsapp: profile.notify_whatsapp,
        notify_telegram: profile.notify_telegram,
    };
}

export function sanitizeOtpCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
}

export function isTelegramAlreadyLinkedError(error: string | null): boolean {
    return !!error && error.includes('уже привязан');
}
