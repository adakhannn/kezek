function parseBooleanFlag(raw: string | undefined, defaultValue: boolean) {
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

export const MOBILE_GOOGLE_NATIVE_AUTH_ENABLED = parseBooleanFlag(
    process.env.EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH,
    true,
);

export const TELEGRAM_DEEPLINK_AUTH_ENABLED = parseBooleanFlag(
    process.env.EXPO_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH,
    true,
);

export const WHATSAPP_MOBILE_AUTH_ENABLED = parseBooleanFlag(
    process.env.EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH,
    true,
);

